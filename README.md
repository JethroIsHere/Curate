# Curate

Curate is an AI art docent system for browsing artworks and asking context-grounded questions about them. It combines a Flask backend, a static frontend, curated artwork metadata, and a fine-tuned Flan-T5 model to generate short answers with evidence.

## What Changed

- The frontend now lives under `frontend/` instead of flat top-level files.
- The backend lives in `backend/` and loads the current best checkpoint by default.
- Evaluation now includes BLEU alongside ROUGE and perplexity.
- The repo includes updated notebooks, curated datasets, and the artwork database used for the current model.

## Repository Layout

```text
Curate/
├── backend/
│   ├── app.py
│   ├── qa_reader.py
│   ├── build_artwork_db.py
│   ├── requirements.txt
│   ├── artworks.db
│   ├── artwork_data.csv
│   ├── evaluation_metrics.py
│   ├── context-variate.py
│   ├── curate_dataset_final.csv
│   ├── curate_dataset_updated.csv
│   ├── docent-flan-t5-finetuned-tweaked1/
│   └── docent-flan-t5-finetuned-final/
│ 
└── frontend/
│   ├── index.html
│   ├── hero-section.*
│   ├── gallery-section.*
│   ├── artwork-view.*
│   ├── about_us-section.*
│   └── assets/
│
└── notebooks/
    ├── curate_baseline.ipynb
    ├── curate_fine_tuned_final.ipynb
    ├── curate_fine_tuned_tweaked1.ipynb
    └── curate_fine_tuned_tweaked2.ipynb
```

## Overview

Curate answers visitor questions about artworks using the artwork context stored in the SQLite database and a fine-tuned text-to-text model. The system is designed to keep responses grounded in the artwork metadata instead of producing free-form hallucinated answers.

## Main Features

- Artwork browsing in the gallery UI.
- Artwork detail pages with image, title, artist, era, description, and context.
- Chat-based docent responses backed by the model in `backend/qa_reader.py`.
- Backend verification logic in `backend/app.py` that rejects malformed or unsupported answers.
- Curated datasets and notebooks for retraining or comparing checkpoints.

## Model and Data

- Default model checkpoint: `backend/flan_t5_base_docent_updated_clean_final/`
- Other local checkpoints: `backend/flan_t5_base_docent_baseline_final/`, `backend/flan_t5_base_docent_updated/`, `backend/flan_t5_base_docent_updated_final/`, `backend/flan_t5_base_docent_updated_clean_final/`
- Primary training data: `backend/curate_dataset.csv`
- Cleaned/updated training data: `backend/curate_dataset_clean.csv`, `backend/curate_dataset_updated.csv`, `backend/curate_dataset_updated_clean.csv`
- Canonical artwork metadata: `backend/artwork_data.csv` and `backend/artworks.db`

The backend reads the model path from `DOCENT_MODEL_PATH` if set. Otherwise it defaults to the current best checkpoint.

## Evaluation Summary

The training and comparison notebooks were used to compare the baseline and updated checkpoints with the following metrics:

| Metric | Purpose |
| --- | --- |
| Exact Match / Accuracy | Checks whether the prediction matches the reference answer after normalization |
| Precision / Recall / F1 | Measures token overlap with the reference answer |
| ROUGE-1 / ROUGE-2 / ROUGE-L | Measures lexical overlap and phrase similarity |
| BLEU | Measures n-gram precision for generated answers |
| Perplexity | Derived from the evaluation loss; lower is better |
| Verification Pass Rate | Measures how often the answer passes grounding checks against artwork context |

The current selected checkpoint is the cleaned updated model because it produced the best overall balance of grounding, answer quality, and evaluation scores.

## Backend

The backend is a Flask app with these main routes:

- `POST /chat` for question answering
- `GET /artworks` for the artwork list
- `GET /artwork_metadata` for a single artwork record

`backend/qa_reader.py` handles model loading and generation. `backend/app.py` handles normalization, verification, fallback behavior, and startup logging.

## Frontend

The UI is a static frontend in `frontend/` built with plain HTML, CSS, and JavaScript. It includes:

- landing/hero content
- gallery browsing
- artwork detail view
- about section

## Setup

Install Python dependencies from the backend folder:

```bash
cd backend
pip install -r requirements.txt
```

If you need to recreate the artwork database, run:

```bash
python build_artwork_db.py
```

## Run Locally

Start the backend from the `backend/` folder:

```bash
python app.py
```

Then open the frontend from the `frontend/` folder using your preferred local server or static file preview.

## Notes

- The large model folders are meant to stay local and should not be committed unless you explicitly want to version them.
- If you move the model checkpoint, set `DOCENT_MODEL_PATH` before starting the backend.
- The repo still includes the notebooks used during the model comparison process so the workflow is reproducible.
