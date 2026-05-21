import traceback
import evaluate
import pandas as pd
from tqdm import tqdm
from transformers import T5ForConditionalGeneration, T5Tokenizer

def run_evaluation():
    print("[Step 1] Script started safely...")
    
    try:
        print("[Step 2] Loading Metrics...")
        rouge = evaluate.load('rouge')
        exact_match = evaluate.load('exact_match')

        print("         -> Loading METEOR...")
        meteor = evaluate.load('meteor')

        print("         -> Loading Semantic Similarity (MiniLM)...")
        from sentence_transformers import SentenceTransformer
        from sklearn.metrics.pairwise import cosine_similarity
        
        # This model is tiny! Won't crash your RAM.
        sem_model = SentenceTransformer('all-MiniLM-L6-v2')

        print("[Step 3] Loading Tokenizer...")
        model_path = "./docent-flan-t5-finetuned-tweaked1"
        tokenizer = T5Tokenizer.from_pretrained(model_path)

        print("[Step 4] Loading AI Model into RAM...")
        model = T5ForConditionalGeneration.from_pretrained(model_path)
        print("         -> Model loaded successfully!")

        print("[Step 5] Loading Dataset...")
        # CHANGE THIS to your actual test dataset filename
        csv_path = "curate_dataset_final.csv" 
        df = pd.read_csv(csv_path).head(45) #checking 200rows of data from dataset
        
        print(f"         -> Found {len(df)} rows to evaluate.")

        predictions = []
        references = []

        print("[Step 6] Running model generation over dataset...")
        
        # tqdm creates a nice progress bar in your terminal
        for index, row in tqdm(df.iterrows(), total=len(df), desc="Generating Answers"):
            
            # CHANGE THESE to match your CSV column headers
            context = row['context']
            question = row['question']
            target = row['answer']  
            
            # Build the exact prompt used during Colab fine-tuning
            prompt = f"Answer the question based strictly on the context. If the answer cannot be found in the context, output exactly 'I am an AI Docent dedicated to this gallery's collection.' Context: {context} Question: {question}"
        
            inputs = tokenizer(prompt, return_tensors="pt")
            outputs = model.generate(**inputs, max_length=50)
            pred = tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            predictions.append(pred)
            references.append(target)

        print("[Step 7] Calculating math...")
        results_rouge = rouge.compute(predictions=predictions, references=references)
        results_em = exact_match.compute(predictions=predictions, references=references)
        results_meteor = meteor.compute(predictions=predictions, references=references)
        print("         -> Calculating Semantic Similarity...")
        # Convert text to vectors
        pred_embeddings = sem_model.encode(predictions)
        ref_embeddings = sem_model.encode(references)
        
        # Calculate Cosine Similarity for each row
        sem_scores = [cosine_similarity([pred_embeddings[i]], [ref_embeddings[i]])[0][0] for i in range(len(predictions))]
        avg_sem_score = sum(sem_scores) / len(sem_scores)

        print("\n" + "="*30)
        print("DATASET EVALUATION RESULTS")
        print("="*30)
        print(f"Total Rows Evaluated : {len(df)}")
        print(f"Exact Match (EM)     : {results_em['exact_match']:.4f}")
        print(f"ROUGE-L              : {results_rouge['rougeL']:.4f}")
        print(f"METEOR               : {results_meteor['meteor']:.4f}")
        print(f"Semantic Sim (MiniLM): {avg_sem_score:.4f}")
        print("="*30)

    except Exception as e:
        print("\n[CRASH CAUGHT] The script threw an error:")
        print(traceback.format_exc())

if __name__ == '__main__':
    run_evaluation()