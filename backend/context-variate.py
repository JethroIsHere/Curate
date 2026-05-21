import pandas as pd
import random
import re
import nltk
from nltk.tokenize import sent_tokenize
from nltk.corpus import stopwords

# Download required NLTK data for sentence splitting and stopwords
nltk.download('punkt')
nltk.download('punkt_tab')
nltk.download('stopwords')
stop_words = set(stopwords.words('english'))

def get_target_sentence_index(context, answer):
    """
    Finds the sentence in the context that most likely contains the answer 
    by checking for the highest overlap of non-stop words.
    """
    sentences = sent_tokenize(context)
    
    # Clean the answer: remove punctuation, lowercase, remove stopwords
    ans_words = set(re.findall(r'\w+', answer.lower())) - stop_words
    
    best_idx = 0
    max_overlap = -1
    
    for i, sent in enumerate(sentences):
        sent_words = set(re.findall(r'\w+', sent.lower())) - stop_words
        overlap = len(ans_words.intersection(sent_words))
        
        if overlap > max_overlap:
            max_overlap = overlap
            best_idx = i
            
    return best_idx, sentences

def variate_context_logic(df):
    """Applies an AGGRESSIVE chopping strategy."""
    print(f"Processing {len(df)} rows...")
    variated_rows = []
    grouped = df.groupby('fact_id')
    
    for fact_id, group in grouped:
        if 'fallback' in str(fact_id).lower():
            for _, row in group.iterrows():
                sentences = sent_tokenize(row['context'])
                if len(sentences) > 2:
                    dice = random.random()
                    if dice < 0.33:
                        row['context'] = sentences[0] # Extremely short
                    elif dice < 0.66:
                        row['context'] = " ".join(sentences[-2:]) # Just the end
                variated_rows.append(row)
            continue

        group_rows = [row.to_dict() for _, row in group.iterrows()]
        for i, row in enumerate(group_rows):
            sentences = sent_tokenize(row['context'])
            
            if len(sentences) < 3:
                variated_rows.append(row)
                continue
                
            target_idx, _ = get_target_sentence_index(row['context'], row['answer'])
            
            # Variations 1-4: FULL CONTEXT (The baseline)
            if i < 4:
                pass 
            # Variation 5: ULTRA SHORT (Only the target sentence)
            elif i == 4:
                row['context'] = sentences[target_idx]
            # Variation 6: TARGET + NEXT SENTENCE
            elif i == 5:
                end_idx = min(len(sentences), target_idx + 2)
                row['context'] = " ".join(sentences[target_idx:end_idx])
            # Variation 7: PREVIOUS + TARGET SENTENCE
            elif i == 6:
                start_idx = max(0, target_idx - 1)
                row['context'] = " ".join(sentences[start_idx:target_idx+1])
            # Variation 8: RANDOM CROP (Target + 1 before + 1 after)
            else:
                start_idx = max(0, target_idx - 1)
                end_idx = min(len(sentences), target_idx + 2)
                row['context'] = " ".join(sentences[start_idx:end_idx])
            
            variated_rows.append(row)

    final_df = pd.DataFrame(variated_rows)
    print(f"Chopping complete! Processed {len(final_df)} rows.")
    return final_df

import os

# --- ACTUAL FILE READING & EXECUTION ---
if __name__ == "__main__":
    # Get the folder where this script is located
    current_folder = os.path.dirname(os.path.abspath(__file__))
    
    # Define the exact names of your input and output files
    # Make sure your original CSV is named exactly this!
    input_path = os.path.join(current_folder, "curate_dataset_updated.csv")
    output_path = os.path.join(current_folder, "curate_dataset_variated2.csv")
    
    print(f"Looking for dataset at: {input_path}")
    
    # Check if the file actually exists
    if not os.path.exists(input_path):
        print("ERROR: Could not find the input CSV. Make sure it is in the same folder as this script!")
    else:
        # 1. Read the CSV
        df = pd.read_csv(input_path, encoding="utf-8")
        
        # 2. Run the chopping function
        df_variated = variate_context_logic(df)
        
        # 3. Save the new, variated CSV
        df_variated.to_csv(output_path, index=False)
        print(f"SUCCESS! New dataset saved to: {output_path}")