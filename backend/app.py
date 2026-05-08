import os
import re
import sqlite3
import unicodedata
from flask import Flask, request, jsonify
from flask_cors import CORS
from qa_reader import QAReader

try:
    from sentence_transformers import SentenceTransformer, util, CrossEncoder
except Exception:
    SentenceTransformer = None
    util = None
    CrossEncoder = None

# Ensure we always look for the DB in the same directory as this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'artworks.db')

app = Flask(__name__)
# Allow your specific frontend port if you want to be strict, but for debugging, allow all:
CORS(app) 

print("Initializing AI Backend...")
try:
    reader = QAReader()
    print(f"✓ Model loaded from: {reader.model_path}")
    print("Backend fully initialized and ready!")
except Exception as e:
    print(f"❌ ERROR loading model in QAReader: {e}")
    # If the model fails, we want to know immediately rather than hanging

# Canonical refusal enforced across the app
CANONICAL_REFUSAL = "I apologize, but my notes do not cover that detail."
_EMBED_MODEL = None
_QA_CROSS_ENCODER = None


def _normalize(s: str) -> str:
    if not s:
        return ''
    s = str(s)
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"\s+", ' ', s).strip().lower()
    return s


def _token_set(text: str):
    norm = _normalize(text)
    return set(re.findall(r"[a-z0-9]+", norm))


def _get_embed_model():
    global _EMBED_MODEL
    if _EMBED_MODEL is not None:
        return _EMBED_MODEL
    if SentenceTransformer is None:
        return None
    try:
        _EMBED_MODEL = SentenceTransformer('all-MiniLM-L6-v2')
    except Exception:
        _EMBED_MODEL = None
    return _EMBED_MODEL


def _get_qa_cross_encoder():
    global _QA_CROSS_ENCODER
    if _QA_CROSS_ENCODER is not None:
        return _QA_CROSS_ENCODER
    if CrossEncoder is None:
        return None
    try:
        _QA_CROSS_ENCODER = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
    except Exception:
        _QA_CROSS_ENCODER = None
    return _QA_CROSS_ENCODER


def _semantic_similarity(text_a: str, text_b: str):
    if not text_a or not text_b:
        return None
    model = _get_embed_model()
    if model is None or util is None:
        return None
    try:
        emb = model.encode([text_a, text_b], convert_to_tensor=True)
        return float(util.cos_sim(emb[0], emb[1]).item())
    except Exception:
        return None


def _qa_alignment_score(question_text: str, answer_text: str):
    if not question_text or not answer_text:
        return None
    cross_encoder = _get_qa_cross_encoder()
    if cross_encoder is not None:
        try:
            score = cross_encoder.predict([(question_text, answer_text)])
            return float(score[0])
        except Exception:
            pass
    return _semantic_similarity(question_text, answer_text)


def _context_supports_answer(answer_text: str, context_text: str) -> bool:
    if not answer_text or not context_text:
        return False
    ans_norm = _normalize(answer_text)
    ctx_norm = _normalize(context_text)

    if ans_norm and (ans_norm in ctx_norm or ctx_norm in ans_norm):
        return True

    ans_tokens = _token_set(answer_text)
    ctx_tokens = _token_set(context_text)
    if not ans_tokens or not ctx_tokens:
        return False

    stop = {
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'of', 'in', 'on', 'to', 'and',
        'for', 'with', 'this', 'that', 'it', 'its', 'as', 'by', 'from', 'at', 'be'
    }
    ans_core = {t for t in ans_tokens if t not in stop}
    ctx_core = {t for t in ctx_tokens if t not in stop}
    if not ans_core or not ctx_core:
        return False

    overlap = len(ans_core & ctx_core) / max(1, len(ans_core))
    if len(ans_core) <= 3:
        return overlap >= 0.67
    return overlap >= 0.5


def _extractive_context_fallback(question_text: str, context_text: str) -> str:
    if not question_text or not context_text:
        return ''
    q_tokens = _token_set(question_text)
    if not q_tokens:
        return ''

    stop = {
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'of', 'in', 'on', 'to', 'and',
        'for', 'with', 'this', 'that', 'it', 'its', 'as', 'by', 'from', 'at', 'be',
        'what', 'who', 'when', 'where', 'why', 'how', 'does', 'did', 'do', 'used',
        'here', 'painting', 'picture', 'artwork'
    }
    q_core = {t for t in q_tokens if t not in stop}
    if not q_core:
        q_core = q_tokens

    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', str(context_text)) if s.strip()]
    if not sentences:
        return ''

    best = ''
    best_score = 0.0

    for sent in sentences:
        s_tokens = _token_set(sent)
        if not s_tokens:
            continue
        overlap = len(q_core & s_tokens)
        score = overlap / max(1, len(q_core))

        sem = _semantic_similarity(question_text, sent)
        if sem is not None:
            score = (0.45 * score) + (0.55 * max(0.0, sem))

        length_penalty = min(len(sent) / 400.0, 0.25)
        score = score - length_penalty

        if score > best_score:
            best_score = score
            best = sent

    if not best or best_score <= 0.02:
        return ''

    if len(best) > 220:
        cut = best.rfind(' ', 0, 217)
        if cut == -1:
            cut = 217
        best = best[:cut].rstrip(' ,;:') + '.'

    return best


def _answer_matches_question(question_text: str, answer_text: str) -> bool:
    if not question_text or not answer_text:
        return False
    a_norm = _normalize(answer_text)
    generic_markers = [
        'i am an ai docent',
        'i can only provide information',
        'i am dedicated to this gallery'
    ]
    if any(g in a_norm for g in generic_markers):
        return False

    score = _qa_alignment_score(question_text, answer_text)
    if score is None:
        return True

    if -1.2 <= score <= 1.2:
        return score >= 0.30
    return score >= -6.0


def _looks_truncated_fragment(text: str) -> bool:
    if not text:
        return True
    s = str(text).strip()
    if len(s) < 8:
        return True
    words = s.split()
    if len(words) < 2:
        return True
    last = words[-1].strip()
    last_clean = last.rstrip('.,;:!?').lower()

    if len(last) == 2 and last[0].isalpha() and last[1] == '.':
        return True
    if last_clean in {'and', 'or', 'the', 'a', 'an', 'in', 'at', 'to', 'from', 'with', 'by', 'as', 'is', 'was'}:
        return True
    if s.endswith((',', ';', '—')):
        return True
    return False


def _looks_malformed_start(text: str) -> bool:
    if not text:
        return False
    s = str(text).strip()
    words = s.split()
    if len(words) < 2:
        return False
    first_word = words[0].strip()
    try:
        if first_word.isdigit() and len(first_word) == 4:
            if len(words) > 1:
                second = words[1].lower().rstrip(',-').strip()
                if second in {'and', 'to', 'or'} or words[1].startswith('-'):
                    return True
    except Exception:
        pass
    return False


def _semantic_supports_answer(answer_text: str, context_text: str, threshold: float = 0.60) -> bool:
    if not answer_text or not context_text:
        return False
    if _context_supports_answer(answer_text, context_text):
        return True
    model = _get_embed_model()
    if model is None or util is None:
        return False
    try:
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', str(context_text)) if s.strip()]
        if not sentences:
            return False
        ans_emb = model.encode(answer_text, convert_to_tensor=True)
        sent_embs = model.encode(sentences, convert_to_tensor=True)
        sims = util.cos_sim(ans_emb, sent_embs)[0]
        best = float(sims.max().item())
        return best >= threshold
    except Exception:
        return False


def _row_to_dict(row):
    return dict(row) if row else None


def get_db_connection():
    # Hardened DB path to prevent empty database generation
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _lookup_artwork(image_filename: str):
    if not image_filename:
        return None
    normalized = os.path.basename(str(image_filename).strip())
    candidates = [normalized]
    if normalized.startswith('The_'):
        candidates.append(normalized.replace('The_', '', 1))
    else:
        candidates.append(f'The_{normalized}')

    try:
        conn = get_db_connection()
        for candidate in candidates:
            row = conn.execute('SELECT * FROM artworks WHERE image_filename = ?', (candidate,)).fetchone()
            if row:
                conn.close()
                return _row_to_dict(row)
        conn.close()
    except Exception as e:
        print(f"DB Lookup Error: {e}")
        return None
    return None


def _parse_sources(raw):
    if not raw:
        return ''
    lines = []
    for ln in str(raw).splitlines():
        s = ln.strip()
        if not s: continue
        low = s.lower()
        if 'http' in low or low.startswith('www.') or 'website link' in low: continue
        s = s.replace('References:', '').replace('Reference:', '').strip()
        s = s.replace('Website Name and Links', '').strip()
        if not s: continue
        lines.append(s)
    seen = set()
    out = []
    for v in lines:
        if v not in seen:
            seen.add(v)
            out.append(v)
    return '; '.join(out)


@app.route('/artworks', methods=['GET'])
def get_artworks():
    try:
        conn = get_db_connection()
        rows = conn.execute('SELECT * FROM artworks').fetchall()
        conn.close()
        artworks = []
        for r in rows:
            a = dict(r)
            a['author'] = a.get('artist') or a.get('author')
            a['era'] = a.get('movement') or a.get('era')
            a['date'] = a.get('year') or a.get('date')
            a['context'] = a.get('context') or a.get('overview') or ''
            a['description'] = a.get('overview') or a.get('context') or a.get('description')
            a['sources'] = _parse_sources(a.get('website_links') or a.get('sources') or '')
            artworks.append(a)
        return jsonify(artworks)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/artwork_metadata', methods=['GET'])
def get_metadata():
    image_filename = request.args.get('image_filename')
    try:
        conn = get_db_connection()
        artwork = conn.execute('SELECT * FROM artworks WHERE image_filename = ?', (image_filename,)).fetchone()
        conn.close()
        if artwork:
            data = dict(artwork)
            data['author'] = data.get('artist') or data.get('author')
            data['era'] = data.get('movement') or data.get('era')
            data['date'] = data.get('year') or data.get('date')
            data['description'] = data.get('overview') or data.get('context') or data.get('description')
            if not data.get('medium'):
                data['medium'] = "Oil on canvas"
            data['sources'] = _parse_sources(data.get('website_links') or data.get('sources') or '') or "Unknown"
            return jsonify(data)
        return jsonify({"error": "Artwork not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    raw_question = data.get('question')
    image_filename = data.get('image_filename') or data.get('imageFilename') or data.get('image')

    context = ""
    if image_filename:
        db_row = _lookup_artwork(image_filename)
        if db_row:
            context = db_row.get('context') if db_row.get('context') else db_row.get('overview')
    
    if not context:
        context = data.get('artwork_context')
        
    if not raw_question or not context or context.strip() == "":
        return jsonify({"error": "I couldn't read the artwork details on this page."}), 400

    clean_question = raw_question
    raw = reader.get_answer(question=clean_question, context=context)

    answer_text = ''
    evidence_text = ''
    if raw:
        parts = raw.split('|| Evidence:')
        answer_text = parts[0].replace('Answer:', '').strip() if parts[0] else ''
        if len(parts) > 1:
            evidence_text = parts[1].strip()

    lower_answer = _normalize(answer_text)
    if any(x in lower_answer for x in [
        "i don't have detailed information", 
        "i do not have detailed information",
        "i don't have information", 
        "i do not have information"
    ]):
        answer_text = CANONICAL_REFUSAL
        evidence_text = ''

    if _looks_truncated_fragment(answer_text) or _looks_malformed_start(answer_text):
        answer_text = CANONICAL_REFUSAL
        evidence_text = ''

    if answer_text == CANONICAL_REFUSAL:
        return jsonify({"answer": CANONICAL_REFUSAL, "evidence": ""})

    verified = False
    if evidence_text:
        try:
            row = _lookup_artwork(image_filename)
        except Exception:
            row = None

        if row:
            e_norm = _normalize(evidence_text)
            for f in ['artist','year','title','context','overview','movement','description','era']:
                val = row.get(f)
                if val and e_norm in _normalize(val):
                    verified = True
                    break
        elif context and _normalize(evidence_text) in _normalize(context):
            verified = True

    if not verified:
        try:
            r = _lookup_artwork(image_filename)
        except Exception:
            r = None

        ans_norm = _normalize(answer_text)
        if r:
            for f in ['artist', 'year', 'title', 'medium', 'movement', 'era', 'overview', 'description', 'context']:
                val = r.get(f)
                if not val: continue
                val_norm = _normalize(val)
                if ans_norm and (ans_norm in val_norm or val_norm in ans_norm):
                    verified = True
                    break
                if _context_supports_answer(answer_text, str(val)):
                    verified = True
                    break

        if (not verified) and answer_text and context:
            verified = _context_supports_answer(answer_text, context)

    if verified and (_looks_truncated_fragment(answer_text) or _looks_malformed_start(answer_text) or not _answer_matches_question(clean_question, answer_text)):
        verified = False

    if not verified:
        try:
            if _semantic_supports_answer(answer_text, context, threshold=0.60):
                verified = True
        except Exception:
            pass

    if verified and (_looks_truncated_fragment(answer_text) or _looks_malformed_start(answer_text) or not _answer_matches_question(clean_question, answer_text)):
        verified = False

    if not verified:
        answer_text = CANONICAL_REFUSAL
        evidence_text = ''

    if answer_text == CANONICAL_REFUSAL:
        fallback = _extractive_context_fallback(clean_question, context)
        if fallback and (not _looks_truncated_fragment(fallback)) and _context_supports_answer(fallback, context):
            answer_text = fallback
            evidence_text = fallback

    return jsonify({"answer": answer_text, "evidence": evidence_text})

if __name__ == '__main__':
    from waitress import serve
    print("🚀 Starting server with Waitress on http://0.0.0.0:5000 ...")
    # Waitress does not use reloaders or extra watcher processes. 
    # It just runs your app.
    serve(app, host='0.0.0.0', port=5000)