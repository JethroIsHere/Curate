"""
QA Reader: loads the fine-tuned flan-t5-base model and provides answer generation.
Expected format: "Answer: <answer_text> || Evidence: <evidence_text>"
"""
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class QAReader:
    def __init__(self, model_path=None):
        """
        Initialize the QA Reader with the fine-tuned model.
        
        Args:
            model_path: path to the fine-tuned model directory (relative to cwd or absolute)
        """
        if model_path is None:
            model_path = os.environ.get(
                "DOCENT_MODEL_PATH",
                "./docent-flan-t5-finetuned-final"  # The final model settled on after evaluation,
            )

        # Resolve model path
        if not os.path.isabs(model_path):
            model_path = os.path.join(os.path.dirname(__file__), model_path)
        
        self.model_path = model_path
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        print(f"Loading tokenizer from {model_path}...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True)
        
        print(f"Loading model from {model_path} on device {self.device}...")
        self.model = AutoModelForSeq2SeqLM.from_pretrained(model_path, local_files_only=True)
        self.model.to(self.device)
        self.model.eval()
        
        print("QAReader initialized successfully!")
    
    def _detect_truncation(self, answer: str) -> bool:
        """Detect truncated/incomplete answers dynamically (no hardcoding)."""
        if not answer:
            return False
        
        words = answer.split()
        if len(words) < 2:
            return True  # Too short to be meaningful
        
        last_word = words[-1]
        second_last_word = words[-2] if len(words) > 1 else ""
        
        # Pattern 1: Ends with single letter + period (e.g., "c.", "d.", "e.")
        # Indicates abbreviation mid-sentence
        if len(last_word) == 2 and last_word[0].isalpha() and last_word[1] == '.':
            return True
        
        # Pattern 2: Ends with incomplete prepositions/conjunctions
        # (natural sentences shouldn't end with these)
        incomplete_endings = ['and', 'or', 'the', 'a', 'in', 'at', 'to', 'from', 'with', 'by', 'as', 'is']
        if last_word.lower().rstrip('.,;:!?') in incomplete_endings:
            return True
        
        # Pattern 3: Sentence ends with comma or semicolon (never proper)
        if answer.rstrip().endswith((',', ';', '—')):
            return True
        
        # Pattern 4: Multiple consecutive incomplete words at end
        # E.g., "between c." or "from the"
        if len(words) >= 3:
            last_two = f"{second_last_word} {last_word}".lower().rstrip('.,;:!?')
            # Check if last two words form an incomplete phrase (short + single letter, etc)
            if len(last_word) <= 2 and len(second_last_word) > 3:  # Longer word followed by very short word
                if last_word[0].isalpha() and last_word[-1] == '.':
                    return True
        
        return False
    
    def _is_valid_answer(self, answer: str, min_length: int = 10) -> bool:
        """Check if answer meets quality guardrails."""
        if not answer or len(answer) < min_length:
            return False
        
        # Dynamic truncation detection
        if self._detect_truncation(answer):
            logger.warning(f"Answer detected as truncated: {answer[:60]}...")
            return False
        
        return True
    
    def get_answer(self, question: str, context: str, max_length: int = 256, min_answer_length: int = 10) -> str:
        """
        Generate an answer using the fine-tuned model with guardrails.
        
        Args:
            question: the user's question
            context: the painting context/description
            max_length: max tokens for generation (increased to 256)
            min_answer_length: minimum acceptable answer length
        
        Returns:
            formatted string: "Answer: <answer> || Evidence: <evidence>"
        """
        if not question or not context:
            logger.warning("Empty question or context")
            return "Answer: I need both a question and artwork context to provide an answer. || Evidence: "
        
        # Build the exact prompt used during Colab fine-tuning
        prompt = f"Answer the question based strictly on the context. If the answer cannot be found in the context, output exactly 'I am an AI Docent dedicated to this gallery's collection.' Context: {context} Question: {question}"
        
        try:
            # Tokenize input
            inputs = self.tokenizer(
                prompt,
                return_tensors="pt",
                truncation=True,
                max_length=512
            ).to(self.device)
            
            # Generate answer with better parameters
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_length=max_length,
                    num_beams=5,           # UPDATED: Use your winning beam count
                    no_repeat_ngram_size=2,
                    repetition_penalty=1.2,
                    length_penalty=1.2,    # UPDATED: Use your winning penalty
                    early_stopping=True,
                    do_sample=False,
                )
            
            # Decode output - the model generates just the answer text
            answer = self.tokenizer.decode(outputs[0], skip_special_tokens=True).strip()
            
            # THE MASTER GUARDRAIL: Check if the model triggered its trained fallback
            # We check for the prefix it was trained on, and map it to the blended refusal
            trained_fallback = "I am an AI Docent dedicated to this gallery's collection."
            blended_refusal = "I am an AI Docent dedicated to this gallery's collection. I apologize, but my notes do not cover that specific detail regarding the artwork we are currently viewing."
            
            if trained_fallback in answer:
                logger.info("Model successfully triggered its internal trained guardrail.")
                return f"Answer: {blended_refusal} || Evidence: "

            # GUARDRAIL 1: Check for truncation and retry with longer max_length
            if self._detect_truncation(answer):
                logger.info(f"Truncation detected, retrying with longer max_length...")
                with torch.no_grad():
                    outputs = self.model.generate(
                        **inputs,
                        max_length=min(512, max_length + 128),  # Increase by 128 tokens, cap at 512
                        num_beams=6,
                        no_repeat_ngram_size=2,
                        repetition_penalty=1.2,
                        length_penalty=0.9,
                        early_stopping=True,
                        do_sample=False,
                    )
                answer = self.tokenizer.decode(outputs[0], skip_special_tokens=True).strip()
            
            # GUARDRAIL 2: Final validation after potential retry
            if not self._is_valid_answer(answer, min_answer_length):
                logger.warning(f"Answer failed validation after retry. Q: {question[:50]}... A: {answer[:50]}...")
                return f"Answer: {blended_refusal} || Evidence: "
            
            # GUARDRAIL 3: Check for empty or generic responses
            if answer.lower() in ['', 'unknown', 'n/a', 'not available']:
                return f"Answer: {blended_refusal} || Evidence: "
            
            logger.info(f"Valid answer generated. Q: {question[:50]}... A: {answer[:50]}...")
            return f"Answer: {answer} || Evidence: "
        
        except Exception as e:
            logger.error(f"Error in get_answer: {e}")
            return "Answer: I encountered a technical error processing your question. Please try again. || Evidence: "


if __name__ == "__main__":
    # Simple test
    reader = QAReader()
    test_q = "Who painted this?"
    test_c = "This is the Mona Lisa, painted by Leonardo da Vinci in the 16th century."
    result = reader.get_answer(test_q, test_c)
    print(f"Q: {test_q}")
    print(f"C: {test_c}")
    print(f"Result: {result}")
