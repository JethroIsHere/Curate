# Curate: AI Art Docent System

## Overview and Introduction

### App Name
**Curate** — An AI-powered docent system for interactive artwork analysis and question-answering using fine-tuned language models.

### Purpose
Curate is an NLP-based system that acts as an intelligent art docent, answering visitor questions about artworks using extractive question-answering. Given a painting and a visitor's question, the system retrieves relevant context from the artwork's metadata and uses a fine-tuned language model to generate accurate, contextually-grounded answers. This enables museums and galleries to provide personalized, interactive educational experiences.

### Problem Statement
Museums and art galleries often lack interactive tools to engage visitors in meaningful conversations about artworks. Traditional static information plaques limit visitor understanding. Curate addresses this by:
1. Accepting natural language questions from visitors
2. Leveraging artwork context and metadata
3. Generating informative, verified answers using fine-tuned generative AI
4. Ensuring answers remain grounded in canonical artwork information (preventing hallucinations)

### Identified Training Corpora
- **Primary Dataset:** `curate_dataset.csv` (2,568 rows)
  - Columns: `fact_id`, `context`, `question`, `answer`
  - Source: crowdsourced and manually curated artwork Q&A pairs
  - Context: painting descriptions, artist info, historical details
  - Task: extractive question-answering paired with artwork context

- **Canonical Metadata:** `artwork_data.csv` and `artworks.db` (14 artworks)
  - Fields: `title`, `artist`, `year`, `context`, `overview`, `movement`, `description`, `era`
  - Used for verification and grounding of model outputs

### Technology Stack and Versions

#### Backend
- **Python:** 3.11.x
- **Flask:** 2.3.x (web framework)
- **Flask-CORS:** 4.x (cross-origin requests)
- **SQLite3:** (built-in, canonical artwork database)

#### NLP & ML
- **Transformers (Hugging Face):** 4.30.x
  - Model: `google/flan-t5-small` (80M parameters)
  - Task: Seq2Seq extractive QA
- **Datasets (Hugging Face):** 2.13.x (data loading & preprocessing)
- **Torch:** 2.x (PyTorch backend for Transformers)
- **Evaluate:** 0.4.x (ROUGE, evaluation metrics)

#### Frontend
- **HTML5 / CSS3**
- **JavaScript (Vanilla)** (no framework)
- **Fetch API** (communicate with backend)

#### Development & Training
- **Google Colab** (GPU training environment)
- **Jupyter Notebook** (training & experimentation)

---

## Functional Requirements

### Core Features

#### 1. **AI-Powered Q&A on Artworks**
   - **Description:** Users submit natural language questions about specific artworks; the system retrieves context from the artwork database and generates answers using the fine-tuned model.
   - **Endpoints:**
     - `POST /chat` — main Q&A endpoint
       - Input: `{ "question": "...", "image_filename": "..." }`
       - Output: `{ "answer": "...", "evidence": "..." }`
   - **Packages:** `Flask`, `Transformers (QAReader)`, `sqlite3`

#### 2. **Text Preprocessing & Tokenization**
   - **Description:** Preprocessing pipeline standardizes input text and prepares it for the fine-tuned model.
   - **Techniques:**
     - Normalization: NFKD Unicode normalization, diacritical mark removal
     - Lowercasing and whitespace normalization
     - Truncation (max 512 tokens for input, 128 for output)
   - **Packages:** `transformers.AutoTokenizer`, `unicodedata`, `regex`

#### 3. **Answer Verification Against Canonical Database**
   - **Description:** Ensures model outputs remain grounded in artwork metadata; rejects hallucinations.
   - **Verification Logic:**
     - Evidence substring matching: checks if evidence appears in artwork context/fields
     - Fuzzy artist name matching: last-name and sequence similarity (threshold 0.75)
     - Year matching: extracts numeric year from answer, compares against database
     - Fallback canonical refusal: "I apologize, but my notes do not cover that detail."
   - **Packages:** `sqlite3`, `difflib`, `regex`

#### 4. **Artwork Metadata Retrieval**
   - **Description:** REST API endpoints for fetching artwork information.
   - **Endpoints:**
     - `GET /artworks` — list all artworks with metadata
     - `GET /artwork_metadata?image_filename=...` — fetch specific artwork details
   - **Packages:** `Flask`, `sqlite3`

#### 5. **Interactive Frontend Gallery**
   - **Description:** Web interface for browsing artworks, viewing details, and interacting with the AI docent.
   - **Components:**
     - Gallery grid view with artwork thumbnails
     - Artwork detail view (image, title, artist, era, description, context)
     - Chat interface (question input, answer display, evidence attribution)
     - About section with project overview
   - **Packages:** HTML5, CSS3, JavaScript (Fetch API)

### NLP Task: Extractive Question-Answering

#### Task Definition
Given a question and artwork context (painting description, artist, era, etc.), the system generates a short, factual answer grounded in the provided context. This is an **extractive QA** task where answers are derived from or heavily grounded in the source material, rather than fully generative.

#### Model Choice: Google Flan-T5-Small
- **Rationale:**
  - Flan-T5 is instruction-tuned on 473 tasks; excels at QA, summarization, and few-shot learning
  - Small variant (80M params) is efficient for CPU deployment while maintaining reasonable quality
  - Seq2Seq architecture (encoder-decoder) naturally handles question + context → answer
  - Pre-trained on diverse corpora including SQuAD-like datasets
  - Fine-tuning on curate_dataset improves domain-specific (art) accuracy
- **Architecture:**
  - Encoder: processes concatenated `Question + Context`
  - Decoder: generates `Answer` token-by-token
  - Loss: cross-entropy on target tokens (padded labels set to -100)

#### Training & Fine-Tuning

**Dataset Preparation:**
- Input: `f"Question: {q}\nContext: {c}\nAnswer:"`
- Target: `{answer_text}`
- Train/Test split: 95% / 5% (2,399 / 169 examples)
- Tokenization:
  - Input max length: 512 tokens
  - Target max length: 128 tokens
  - Padding strategy: `longest` (pad to longest sequence in batch)
  - Loss masking: pad token ID (-100) ignored in loss computation
- Preprocessing note: stopword removal, stemming, and lemmatization are intentionally avoided because this is a context-grounded QA task and those steps can remove names, dates, and stylistic wording that the docent needs to answer accurately.

**Training Configuration (Colab GPU):**
```python
num_train_epochs = 3
learning_rate = 2e-5
per_device_train_batch_size = 8
gradient_accumulation_steps = 2
warmup_steps = 500
weight_decay = 0.01
logging_steps = 100
save_steps = 500
eval_strategy = "steps"
eval_steps = 500
fp16 = True  # mixed precision
```

**Model Location:**
- Fine-tuned model saved to `backend/flan_t5_small_docent_final/`
- Contains: `config.json`, `model.safetensors`, `tokenizer.json`, `generation_config.json`, `training_args.bin`

#### Inference Flow
1. User submits question + artwork image filename
2. Fetch artwork context from DB (SQLite)
3. Construct prompt: `f"Question: {q}\nContext: {c}\nAnswer:"`
4. Tokenize & truncate input (max 512 tokens)
5. Generate output using fine-tuned model:
   - `num_beams=2` (beam search for diversity)
   - `temperature=0.7`, `top_p=0.9` (sampling for variation)
   - Max length: 128 tokens
6. Decode output tokens to text
7. Parse and verify answer against canonical DB
8. Return answer + evidence to frontend

### Model Evaluation

#### Metrics Computed
- **Accuracy / Exact Match:** % of predictions that exactly match the reference answer after normalization
- **Precision, Recall, F1-score:** token-overlap metrics for generated answers vs. references
- **ROUGE-1, ROUGE-2, ROUGE-L:** lexical overlap between predicted answers and reference answers
  - ROUGE-1: unigram overlap (word-level)
  - ROUGE-2: bigram overlap (phrase-level)
  - ROUGE-L: longest common subsequence (semantic preservation)
- **BLEU:** optional n-gram precision metric for generated answer quality
- **Perplexity:** computed from the evaluation loss to measure how confidently the model predicts the target text
- **Verification Pass Rate:** % of model outputs that pass the grounding logic against the artwork database

#### Baseline Comparison
- **Baseline:** Canonical refusal for all queries (trivial but safe)
  - Accuracy / F1: low or near-zero for content questions
  - ROUGE: 0 (no overlap with any real answers)
  - Perplexity: not meaningful for a refusal-only baseline, but it does not generate grounded text
  - Verification: 100% (always passes)
  - User satisfaction: Low (uninformative)
- **Fine-tuned Model:**
  - Accuracy / Exact Match: higher on factual questions after grounding rules are applied
  - Precision / Recall / F1: reflects overlap with reference answers on the held-out eval split
  - ROUGE (expected): 0.3–0.5 range (partial overlap due to paraphrasing)
  - Perplexity: lower than the baseline training-loss-free setup, indicating better target fit
  - Verification (target): 60–80% (model learns to ground answers in context)
  - User satisfaction: High (meaningful, accurate responses for grounded questions)

#### Error Analysis
- **Hallucinations:** Model generates plausible-sounding answers not in context
  - Mitigation: Verification logic rejects unverifiable answers
- **Off-topic answers:** Question + context mismatch
  - Mitigation: Training data filtering; verification
- **Short/empty answers:** Model generates minimal text
  - Mitigation: Fine-tuning hyperparameter tuning; post-processing length penalties

---

## Functional Requirements (Core Libraries & Packages)

| Library | Version | Purpose |
|---------|---------|---------|
| Flask | 2.3.x | Web framework for REST API |
| Flask-CORS | 4.x | Handle cross-origin requests |
| Transformers | 4.30.x | Load & fine-tune `google/flan-t5-small` |
| Torch | 2.x | PyTorch backend for Transformers |
| Datasets | 2.13.x | Load & preprocess CSV data |
| Evaluate | 0.4.x | Compute ROUGE metrics |
| Tokenizers | 0.13.x | Fast tokenization (Transformers dependency) |
| Numpy | 1.24.x | Numerical operations |
| Pandas | 2.x | (Optional) Data inspection |

---

## Future Enhancements and Roadmap

### Known Limitations

1. **Model Size & Latency:**
   - Flan-T5-small (80M params) is CPU-deployable but slow (~5–10s per inference on CPU)
   - **Mitigation:** Deploy on GPU/TPU infrastructure for sub-second responses

2. **Limited Training Data:**
   - Fine-tuning dataset (`curate_dataset.csv`) has ~2.5K examples (small by LLM standards)
   - **Mitigation:** Expand training corpus; use data augmentation

3. **Static Artwork Database:**
   - Hard-coded 14 artworks; museum staff cannot add artworks via UI
   - **Mitigation:** Build admin dashboard for artwork CRUD operations

4. **No Multi-language Support:**
   - System currently English-only
   - **Mitigation:** Fine-tune multilingual variants (mT5, mFLAN-T5)

5. **Answer Verification Strictness:**
   - Conservative verification logic may reject valid answers that paraphrase context
   - **Mitigation:** Implement semantic similarity metrics (e.g., BERTScore) for softer verification

### Planned Features & Improvements

#### Phase 2: Enhanced User Experience
- **Real-time answer streaming:** Use Server-Sent Events (SSE) for progressive answer generation
- **Citation-aware responses:** Highlight which database field(s) support each answer
- **Conversation history:** Allow users to maintain multi-turn conversations about artworks
- **Accessibility improvements:** ARIA labels, keyboard navigation, screen reader support

#### Phase 3: Admin & Extensibility
- **Admin dashboard:** Add/edit/delete artworks without database access
- **Fine-tuning on custom corpora:** Allow museums to fine-tune on their own artwork descriptions
- **Model versioning:** Track multiple fine-tuned model checkpoints
- **A/B testing:** Compare model outputs (e.g., Flan-T5-small vs. base T5)

#### Phase 4: Advanced NLP
- **Multi-modal QA:** Accept image + text questions; use vision transformers to enhance context
- **Named entity recognition (NER):** Extract artist names, dates, movements from Q&A pairs
- **Semantic search:** Use embeddings (Sentence-BERT) to retrieve relevant artworks for questions
- **Fact-checking:** Cross-reference model answers with Wikipedia, museum databases

#### Phase 5: Deployment & Scaling
- **Containerization:** Docker + Kubernetes for cloud deployment
- **Caching:** Redis for frequent queries (artist names, common questions)
- **Monitoring:** Prometheus/Grafana for model performance tracking
- **Load balancing:** Horizontal scaling for high-traffic museum events

---

## Running the System

### Backend Setup

1. **Create virtual environment:**
   ```bash
   cd backend
   python -m venv venv
   .\venv\Scripts\Activate.ps1  # Windows
   # or: source venv/bin/activate  # macOS/Linux
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start Flask server:**
   ```bash
   python app.py
   ```
   Backend listens on `http://localhost:5000`

### Frontend Setup

1. **Navigate to frontend folder:**
   ```bash
   cd ../frontend
   ```

2. **Serve static files:**
   ```bash
   # Using Python's built-in server
   python -m http.server 8000
   ```
   Open `http://localhost:8000` in browser

### Training on Google Colab

1. Open `backend/finetune_flan_t5_colab.ipynb` in Google Colab
2. Set Runtime → GPU
3. Upload `backend/curate_dataset.csv` or mount Google Drive
4. Run all cells top-to-bottom
5. Download fine-tuned model from Colab output or push to Hugging Face Hub

---

## Project Structure

```
Curate/
├── backend/
│   ├── app.py                              # Flask application
│   ├── qa_reader.py                        # QAReader class (model inference)
│   ├── artworks.db                         # SQLite database (canonical artwork metadata)
│   ├── artwork_data.csv                    # Original artwork CSV
│   ├── curate_dataset.csv                  # Fine-tuning dataset (2,568 Q&A pairs)
│   ├── finetune_flan_t5_colab.ipynb        # Colab notebook for training
│   ├── flan_t5_small_docent_final/         # Fine-tuned model (Transformers format)
│   ├── requirements.txt                    # Python dependencies
│   ├── venv/                               # Python virtual environment
│   └── __pycache__/
├── frontend/
│   ├── index.html                          # Main landing page
│   ├── hero-section.{html,css,js}          # Hero/banner
│   ├── gallery-section.{html,css,js}       # Artwork grid
│   ├── artwork-view.{html,css,js}          # Artwork detail + chat
│   ├── about_us-section.{html,css,js}      # About/project info
│   ├── assets/
│   │   ├── art_images/                     # Artwork image files
│   │   ├── icon_images/                    # UI icons
│   │   └── member_images/                  # Team photos
└── README.md                               # This file
```

---

## Author & Acknowledgments

**Project:** CCS 249 Final Project — AI Art Docent System  
**Institution:** West Visayas State University, College of Information and Communications Technology  
**Developed:** 2026  

**Key Libraries:**
- Hugging Face Transformers & Datasets
- Flask & Flask-CORS
- PyTorch

---

## License

This project is for educational purposes as part of CCS 249 (Natural Language Processing).
