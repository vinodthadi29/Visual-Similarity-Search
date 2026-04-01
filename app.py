import os
import json
from PIL import Image
from flask import Flask, render_template, request, jsonify, send_from_directory, session, redirect, url_for
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from core.feature_extractor import FeatureExtractor
from core.vector_store import VectorStore
from core.explainability import GradCAMExplainer
from core.object_detector import ObjectDetector

app = Flask(__name__)
app.secret_key = 'astra-guardian-secret-key-3d'
USERS_FILE = 'users.json'

# Configure folders
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['HEATMAP_FOLDER'] = 'static/heatmaps'
# Use os.getcwd() to make the path relative to the current project location on D: drive
app.config['DATASET_FOLDER'] = os.path.join(os.getcwd(), 'dataset', 'gallery', 'archive', 'caltech-101')

import sqlite3

# --- Database Setup ---
DB_FILE = 'auth.db'

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users 
                 (username TEXT PRIMARY KEY, password TEXT)''')
    conn.commit()
    conn.close()

init_db()

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

import logging

# Configure logging to file
log_handler = logging.FileHandler('app_debug.log')
log_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s %(levelname)s: %(message)s')
log_handler.setFormatter(formatter)

app.logger.addHandler(log_handler)
logging.getLogger('werkzeug').addHandler(log_handler) # Capture Flask request logs

@app.before_request
def log_request_info():
    app.logger.info(f"Request: {request.method} {request.path}")

@app.route('/debug/users')
def debug_users():
    conn = get_db_connection()
    users = conn.execute('SELECT username FROM users').fetchall()
    conn.close()
    return jsonify([u['username'] for u in users])

print("Loading ML Pipeline (YOLOv8, MobileNetV2, FAISS, Grad-CAM)...")
detector = ObjectDetector()
extractor = FeatureExtractor()
vector_store = VectorStore()
explainer = GradCAMExplainer()
print("System Ready.")

# --- UI Routes ---

@app.route('/')
def landing():
    """Serves the premium 3D landing page."""
    return render_template('landing.html')

@app.route('/search')
def index():
    """Serves the main Neural Search interface (protected)."""
    if 'user' not in session:
        logging.info("Unauthorized access to /search, redirecting to /login")
        return redirect(url_for('login'))
    return render_template('index.html')

@app.route('/login')
def login():
    """Serves the 3D login page."""
    if 'user' in session:
        return redirect(url_for('index'))
    return render_template('login.html')

@app.route('/signup')
def signup():
    """Serves the 3D signup page."""
    if 'user' in session:
        return redirect(url_for('index'))
    return render_template('signup.html')

@app.route('/logout')
def logout():
    user = session.pop('user', None)
    logging.info(f"User logged out: {user}")
    return redirect(url_for('landing'))

@app.route('/team')
def team():
    """Serves the Project Team page."""
    return render_template('team.html')

@app.route('/about')
def about():
    """Serves the Project Explanation page."""
    return render_template('about.html')

@app.route('/dataset/<path:subpath>')
def serve_dataset_image(subpath):
    """Serves images directly from the deeply nested Caltech-101 folders."""
    return send_from_directory(app.config['DATASET_FOLDER'], subpath)

# --- API Routes ---

@app.route('/api/detect', methods=['POST'])
def detect():
    """Stage 1: YOLOv8 Object Detection"""
    if 'query_image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400
        
    file = request.files['query_image']
    if file:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        # Get bounding boxes from YOLO
        boxes = detector.detect(filepath)
        return jsonify({"success": True, "filepath": filepath, "boxes": boxes})

@app.route('/api/search', methods=['POST'])
def search():
    """Stage 2: Feature Extraction & FAISS Search (with optional Cropping)"""
    filepath = request.form.get('filepath')
    crop_data = request.form.get('crop_data')

    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "Image not found"}), 400

    try:
        search_path = filepath
        
        # If the user clicked a bounding box, crop the image first
        if crop_data:
            coords = json.loads(crop_data)
            img = Image.open(filepath)
            cropped_img = img.crop((coords['x1'], coords['y1'], coords['x2'], coords['y2']))
            
            search_path = filepath.replace(".", "_cropped.")
            cropped_img.save(search_path)

        # 1. Similarity Search
        query_vector = extractor.extract(search_path)
        results = vector_store.search(query_vector, k=5)
        
        # 2. XAI Processing (Optional)
        xai_enabled = request.form.get('xai_enabled') == 'true'
        query_hm_path = None
        
        if xai_enabled:
            query_hm_path = os.path.join(app.config['HEATMAP_FOLDER'], f"hm_query_{os.path.basename(search_path)}")
            explainer.generate_heatmap(search_path, query_hm_path)
            query_hm_path = query_hm_path.replace('\\', '/')

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

# --- Auth API ---

@app.route('/api/signup', methods=['POST'])
def api_signup():
    data = request.json
    if not data:
        return jsonify({"success": False, "message": "No data provided"}), 400
        
    username = data.get('username')
    password = data.get('password')
    
    logging.info(f"Signup attempt: {username}")
    
    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400
        
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO users (username, password) VALUES (?, ?)", 
                    (username, generate_password_hash(password)))
        conn.commit()
        logging.info(f"Signup success: {username}")
        return jsonify({"success": True, "message": "Account created! Redirecting to login..."})
    except sqlite3.IntegrityError:
        logging.info(f"Signup failed: {username} already exists")
        return jsonify({"success": False, "message": "Username already exists"}), 400
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json
    if not data:
        return jsonify({"success": False, "message": "No data provided"}), 400

    username = data.get('username')
    password = data.get('password')
    
    logging.info(f"Login attempt: {username}")
    
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()
    
    if user and check_password_hash(user['password'], password):
        session['user'] = username
        session.permanent = True # Keep session alive
        logging.info(f"Login success: {username}")
        return jsonify({"success": True})
    
    logging.info(f"Login failed: {username}")
    return jsonify({"success": False, "message": "Invalid username or password"}), 401

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)