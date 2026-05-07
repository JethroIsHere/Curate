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
                "flan_t5_base_docent_updated_clean_final",
            )

        # Resolve model path
        if not os.path.isabs(model_path):
            model_path = os.path.join(os.path.dirname(__file__), model_path)
        
        self.model_path = model_path
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        print(f"Loading tokenizer from {model_path}...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        
        print(f"Loading model from {model_path} on device {self.device}...")
        self.model = AutoModelForSeq2SeqLM.from_pretrained(model_path)
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
        
        # Build the prompt in the same format as training (critical for model performance)
        prompt = f"Question: {question}\nContext: {context}\nAnswer:"
        
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
                    num_beams=4,
                    no_repeat_ngram_size=2,
                    repetition_penalty=1.2,
                    length_penalty=0.6,
                    early_stopping=True,
                    do_sample=False,
                )
            
            # Decode output - the model generates just the answer text
            answer = self.tokenizer.decode(outputs[0], skip_special_tokens=True).strip()
            
            # GUARDRAIL 1: Check for truncation and retry with longer max_length
            if self._detect_truncation(answer):
                logger.info(f"Truncation detected, retrying with longer max_length...")
                with torch.no_grad():
                    outputs = self.model.generate(
                        **inputs,
                        max_length=min(512, max_length + 128),  # Increase by 128 tokens, cap at 512
                        num_beams=4,
                        no_repeat_ngram_size=2,
                        repetition_penalty=1.2,
                        length_penalty=0.6,
                        early_stopping=True,
                        do_sample=False,
                    )
                answer = self.tokenizer.decode(outputs[0], skip_special_tokens=True).strip()
            
            # GUARDRAIL 2: Final validation after potential retry
            if not self._is_valid_answer(answer, min_answer_length):
                logger.warning(f"Answer failed validation after retry. Q: {question[:50]}... A: {answer[:50]}...")
                return f"Answer: I apologize, but I don't have detailed information about that aspect of this artwork. || Evidence: "
            
            # GUARDRAIL 3: Check for empty or generic responses
            if answer.lower() in ['', 'unknown', 'n/a', 'not available']:
                return f"Answer: I apologize, but I don't have detailed information about that aspect of this artwork. || Evidence: "
            
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
