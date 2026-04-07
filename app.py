import os
import json
import time
import logging
import sqlite3
from PIL import Image
from flask import (Flask, render_template, request, jsonify,
                   send_from_directory, session, redirect, url_for,
                   Response, stream_with_context)
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from core.feature_extractor import FeatureExtractor
from core.vector_store import VectorStore
from core.explainability import GradCAMExplainer
from core.object_detector import ObjectDetector
from core.similarity import (color_histogram_similarity, texture_similarity,
                              hybrid_score, reduce_to_3d)

app = Flask(__name__)
app.secret_key = os.environ.get('SESSION_SECRET', os.urandom(24))

app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['HEATMAP_FOLDER'] = 'static/heatmaps'
app.config['DATASET_FOLDER'] = os.path.join(os.getcwd(), 'dataset', 'gallery', 'archive', 'caltech-101')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['HEATMAP_FOLDER'], exist_ok=True)

DB_FILE = 'auth.db'

last_embeddings_store = {}


def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (username TEXT PRIMARY KEY, password TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS search_history
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  username TEXT,
                  query_image TEXT,
                  result_count INTEGER,
                  processing_time REAL,
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    c.execute('''CREATE TABLE IF NOT EXISTS feedback
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  username TEXT,
                  result_path TEXT,
                  rating INTEGER,
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    conn.commit()
    conn.close()


init_db()


def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


log_handler = logging.FileHandler('app_debug.log')
log_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s %(levelname)s: %(message)s')
log_handler.setFormatter(formatter)
app.logger.addHandler(log_handler)
logging.getLogger('werkzeug').addHandler(log_handler)


@app.before_request
def log_request_info():
    app.logger.info(f"Request: {request.method} {request.path}")


print("Loading ML Pipeline (YOLOv8, MobileNetV2, FAISS, Grad-CAM)...")
detector = ObjectDetector()
extractor = FeatureExtractor()
vector_store = VectorStore()
explainer = GradCAMExplainer()
print("System Ready.")


@app.route('/')
def landing():
    return render_template('landing.html')


@app.route('/search')
def index():
    if 'user' not in session:
        return redirect(url_for('login'))
    return render_template('index.html')


@app.route('/login')
def login():
    if 'user' in session:
        return redirect(url_for('index'))
    return render_template('login.html')


@app.route('/signup')
def signup():
    if 'user' in session:
        return redirect(url_for('index'))
    return render_template('signup.html')


@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('landing'))


@app.route('/team')
def team():
    return render_template('team.html')


@app.route('/about')
def about():
    return render_template('about.html')


@app.route('/dataset/<path:subpath>')
def serve_dataset_image(subpath):
    return send_from_directory(app.config['DATASET_FOLDER'], subpath)


@app.route('/api/detect', methods=['POST'])
def detect():
    if 'query_image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400
    file = request.files['query_image']
    if file:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        boxes = detector.detect(filepath)
        return jsonify({"success": True, "filepath": filepath, "boxes": boxes})
    return jsonify({"error": "Invalid file"}), 400


@app.route('/api/search', methods=['POST'])
def search():
    filepath = request.form.get('filepath')
    crop_data = request.form.get('crop_data')
    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "Image not found"}), 400
    try:
        search_path = filepath
        if crop_data:
            coords = json.loads(crop_data)
            img = Image.open(filepath)
            cropped_img = img.crop((coords['x1'], coords['y1'], coords['x2'], coords['y2']))
            search_path = filepath.replace(".", "_cropped.")
            cropped_img.save(search_path)
        query_vector = extractor.extract(search_path)
        results = vector_store.search(query_vector, k=10)
        xai_enabled = request.form.get('xai_enabled') == 'true'
        query_hm_path = None
        if xai_enabled:
            query_hm_path = os.path.join(app.config['HEATMAP_FOLDER'], f"hm_query_{os.path.basename(search_path)}")
            explainer.generate_heatmap(search_path, query_hm_path)
        for match in results:
            if xai_enabled:
                dataset_img_path = os.path.join(app.config['DATASET_FOLDER'], match['image_path'])
                safe_name = match['image_path'].replace('\\', '_').replace('/', '_')
                match_hm_path = os.path.join(app.config['HEATMAP_FOLDER'], f"hm_{safe_name}")
                explainer.generate_heatmap(dataset_img_path, match_hm_path)
                match['heatmap_path'] = match_hm_path.replace('\\', '/')
            else:
                match['heatmap_path'] = None
        return jsonify({
            "success": True,
            "query_image": search_path.replace('\\', '/'),
            "query_heatmap": query_hm_path,
            "matches": results
        })
    except Exception as e:
        logging.error(f"Search error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/stream-search', methods=['POST'])
def stream_search():
    if 'user' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    file = request.files.get('query_image')
    crop_data = request.form.get('crop_data')
    xai_enabled = request.form.get('xai_enabled') == 'true'

    if not file:
        return jsonify({"error": "No image provided"}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    username = session.get('user', 'anonymous')

    def sse_event(data):
        return f"data: {json.dumps(data)}\n\n"

    def generate():
        t0 = time.time()
        try:
            yield sse_event({'stage': 'uploaded', 'progress': 10,
                             'message': 'Image received and saved'})

            yield sse_event({'stage': 'detecting', 'progress': 25,
                             'message': 'Running YOLOv8 object detection...'})

            search_path = filepath
            if crop_data:
                coords = json.loads(crop_data)
                img = Image.open(filepath)
                cropped = img.crop((coords['x1'], coords['y1'], coords['x2'], coords['y2']))
                search_path = filepath.replace('.', '_crop.')
                cropped.save(search_path)
                boxes = []
            else:
                boxes = detector.detect(filepath)

            yield sse_event({'stage': 'detected', 'progress': 40,
                             'message': f'Detected {len(boxes)} objects',
                             'boxes': boxes, 'filepath': filepath})

            yield sse_event({'stage': 'extracting', 'progress': 58,
                             'message': 'Extracting MobileNetV2 neural embeddings...'})

            query_vector = extractor.extract(search_path)

            yield sse_event({'stage': 'searching', 'progress': 72,
                             'message': 'Searching FAISS vector index...'})

            results = vector_store.search(query_vector, k=10)

            yield sse_event({'stage': 'analyzing', 'progress': 85,
                             'message': 'Computing hybrid similarity scores...'})

            dataset_folder = app.config['DATASET_FOLDER']
            enhanced_results = []
            result_vectors = [query_vector.tolist()]
            result_labels = ['query']
            result_image_paths = ['']

            query_hm_path = None
            if xai_enabled:
                try:
                    query_hm_path = os.path.join(
                        app.config['HEATMAP_FOLDER'],
                        f"hm_query_{os.path.basename(search_path)}")
                    explainer.generate_heatmap(search_path, query_hm_path)
                    query_hm_path = query_hm_path.replace('\\', '/')
                except Exception:
                    query_hm_path = None

            for i, match in enumerate(results):
                dataset_img_path = os.path.join(dataset_folder, match['image_path'])
                color_sim = color_histogram_similarity(search_path, dataset_img_path)
                tex_sim = texture_similarity(search_path, dataset_img_path)
                h_score = hybrid_score(match['similarity_score'], color_sim, tex_sim)

                heatmap_path = None
                if xai_enabled and os.path.exists(dataset_img_path):
                    try:
                        safe_name = match['image_path'].replace('\\', '_').replace('/', '_')
                        heatmap_path = os.path.join(app.config['HEATMAP_FOLDER'], f"hm_{safe_name}")
                        explainer.generate_heatmap(dataset_img_path, heatmap_path)
                        heatmap_path = heatmap_path.replace('\\', '/')
                    except Exception:
                        heatmap_path = None

                img_path_clean = match['image_path'].replace('\\', '/')
                enhanced_results.append({
                    'image_path': img_path_clean,
                    'similarity_score': round(h_score, 4),
                    'feature_similarity': round(float(match['similarity_score']), 4),
                    'color_similarity': round(color_sim, 4),
                    'texture_similarity': round(tex_sim, 4),
                    'rank': i + 1,
                    'heatmap_path': heatmap_path
                })

                try:
                    vec = extractor.extract(dataset_img_path)
                    result_vectors.append(vec.tolist())
                    result_labels.append(img_path_clean)
                    result_image_paths.append(img_path_clean)
                except Exception:
                    result_vectors.append([0.0] * 1280)
                    result_labels.append(img_path_clean)
                    result_image_paths.append(img_path_clean)

            enhanced_results.sort(key=lambda x: x['similarity_score'], reverse=True)
            for i, r in enumerate(enhanced_results):
                r['rank'] = i + 1

            try:
                points_3d = reduce_to_3d(result_vectors)
                last_embeddings_store[username] = {
                    'points': points_3d,
                    'labels': result_labels,
                    'image_paths': result_image_paths,
                    'scores': [1.0] + [r['similarity_score'] for r in enhanced_results]
                }
            except Exception:
                pass

            processing_time = round(time.time() - t0, 2)

            try:
                conn = get_db_connection()
                conn.execute(
                    'INSERT INTO search_history (username, query_image, result_count, processing_time) VALUES (?, ?, ?, ?)',
                    (username, os.path.basename(filepath), len(enhanced_results), processing_time)
                )
                conn.commit()
                conn.close()
            except Exception:
                pass

            yield sse_event({
                'stage': 'complete',
                'progress': 100,
                'message': f'Found {len(enhanced_results)} matches in {processing_time}s',
                'results': enhanced_results,
                'query_image': search_path.replace('\\', '/'),
                'query_heatmap': query_hm_path,
                'processing_time': processing_time,
                'total_results': len(enhanced_results)
            })

        except Exception as e:
            logging.error(f"Stream search error: {str(e)}")
            yield sse_event({'stage': 'error', 'message': str(e)})

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive'
        }
    )


@app.route('/api/embeddings')
def get_embeddings():
    if 'user' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    username = session.get('user')
    data = last_embeddings_store.get(username, {'points': [], 'labels': [], 'image_paths': [], 'scores': []})
    return jsonify(data)


@app.route('/api/feedback', methods=['POST'])
def feedback():
    if 'user' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    if not data:
        return jsonify({"error": "No data"}), 400
    result_path = data.get('result_path', '')
    rating = data.get('rating', 0)
    if rating not in [1, -1]:
        return jsonify({"error": "Rating must be 1 or -1"}), 400
    username = session.get('user')
    try:
        conn = get_db_connection()
        conn.execute(
            'INSERT INTO feedback (username, result_path, rating) VALUES (?, ?, ?)',
            (username, result_path, rating)
        )
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/history')
def history():
    if 'user' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    username = session.get('user')
    try:
        conn = get_db_connection()
        rows = conn.execute(
            'SELECT id, query_image, result_count, processing_time, timestamp FROM search_history WHERE username = ? ORDER BY timestamp DESC LIMIT 20',
            (username,)
        ).fetchall()
        conn.close()
        return jsonify({'history': [dict(r) for r in rows]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/explain', methods=['POST'])
def explain():
    if 'user' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    query_path = data.get('query_path')
    result_path = data.get('result_path')
    feature_sim = data.get('feature_similarity', 0)
    color_sim = data.get('color_similarity', 0)
    tex_sim = data.get('texture_similarity', 0)

    if not query_path or not result_path:
        return jsonify({"error": "Missing paths"}), 400

    full_result_path = os.path.join(app.config['DATASET_FOLDER'], result_path)

    breakdown = {
        'shape_structure': round(feature_sim * 100, 1),
        'color_palette': round(color_sim * 100, 1),
        'texture_detail': round(tex_sim * 100, 1),
        'overall': round(hybrid_score(feature_sim, color_sim, tex_sim) * 100, 1)
    }

    dominant = max(breakdown, key=lambda k: breakdown[k] if k != 'overall' else 0)
    explanations = {
        'shape_structure': 'These images share strong structural patterns and edge compositions.',
        'color_palette': 'The dominant color distributions and palettes closely match.',
        'texture_detail': 'Surface textures and fine-grained details are highly similar.'
    }

    heatmap_path = None
    try:
        safe_name = result_path.replace('\\', '_').replace('/', '_')
        heatmap_path = os.path.join(app.config['HEATMAP_FOLDER'], f"hm_{safe_name}")
        if not os.path.exists(heatmap_path):
            explainer.generate_heatmap(full_result_path, heatmap_path)
        heatmap_path = heatmap_path.replace('\\', '/')
    except Exception:
        heatmap_path = None

    return jsonify({
        'breakdown': breakdown,
        'explanation': explanations.get(dominant, 'Shared visual features drive this similarity.'),
        'heatmap_path': heatmap_path
    })


@app.route('/api/signup', methods=['POST'])
def api_signup():
    data = request.json
    if not data:
        return jsonify({"success": False, "message": "No data provided"}), 400
    username = data.get('username', '').strip()
    password = data.get('password', '')
    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400
    if len(password) < 6:
        return jsonify({"success": False, "message": "Password must be at least 6 characters"}), 400
    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            (username, generate_password_hash(password))
        )
        conn.commit()
        return jsonify({"success": True, "message": "Account created! Redirecting to login..."})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "Username already exists"}), 400
    finally:
        conn.close()


@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json
    if not data:
        return jsonify({"success": False, "message": "No data provided"}), 400
    username = data.get('username', '')
    password = data.get('password', '')
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()
    if user and check_password_hash(user['password'], password):
        session['user'] = username
        session.permanent = True
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Invalid username or password"}), 401


if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5000, threaded=True)
