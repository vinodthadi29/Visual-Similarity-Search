# Astra Guardian - AI Visual Search System

## Overview
An AI-powered image similarity search system built with Flask. Uses YOLOv8 for object detection, MobileNetV2 for feature extraction, FAISS for vector similarity search, and Grad-CAM for explainability heatmaps.

## Architecture
- **Backend**: Flask (Python) — `app.py`
- **ML Pipeline**: TensorFlow/Keras (MobileNetV2), Ultralytics (YOLOv8), FAISS (vector store), OpenCV (image processing)
- **Auth**: SQLite-based user auth with password hashing (`auth.db`)
- **Frontend**: Jinja2 HTML templates in `templates/`, static assets in `static/`
- **Port**: 5000

## Key Directories
- `app.py` — Main Flask application entry point
- `core/` — ML pipeline modules (feature_extractor, vector_store, explainability, object_detector)
- `templates/` — HTML pages (landing, login, signup, search, team, about)
- `static/` — CSS, JS, uploads (user images), heatmaps (Grad-CAM output)
- `dataset/` — Caltech-101 image dataset (not included in repo)
- `index_data/` — FAISS index files

## Environment Variables
- `SESSION_SECRET` — Flask session secret key (set in Replit Secrets)

## Running
The app starts via the "Start application" workflow: `python3 app.py`

## Notes
- Uses `opencv-python-headless` (not `opencv-python`) for server compatibility
- numpy pinned to 1.26.4 for compatibility between tensorflow, faiss-cpu, and opencv
- The `/debug/users` endpoint was removed for security
- Dataset (Caltech-101) must be placed in `dataset/gallery/archive/caltech-101/` for search to return results
- YOLOv8n model (`yolov8n.pt`) is auto-downloaded on first start
