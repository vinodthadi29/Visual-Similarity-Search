# AstraVision — Visual Intelligence Platform

## Overview
A production-grade AI-powered visual similarity search system. Upload any image and it runs through a full ML pipeline: YOLOv8 object detection, MobileNetV2 feature extraction, FAISS vector search, and Grad-CAM explainability — with real-time streaming progress and hybrid similarity scoring.

## Architecture
- **Backend**: Flask (Python, threaded, no debug) — `app.py`
- **ML Pipeline**: TensorFlow/Keras (MobileNetV2), Ultralytics (YOLOv8), FAISS (vector store), OpenCV (image processing + color histograms)
- **Auth**: SQLite-based user auth with bcrypt password hashing (`auth.db`)
- **Frontend**: Jinja2 HTML templates + vanilla JS with Three.js, GSAP, Lucide icons
- **Port**: 5000

## Key Files
- `app.py` — Main Flask app with all routes and streaming SSE pipeline
- `core/feature_extractor.py` — MobileNetV2 1280-d embedding extraction
- `core/vector_store.py` — FAISS index management
- `core/explainability.py` — Grad-CAM heatmap generation
- `core/object_detector.py` — YOLOv8n object detection
- `core/similarity.py` — Hybrid scoring (color histogram + texture + feature similarity)
- `templates/` — HTML pages (landing, login, signup, search, team, about)
- `static/css/style.css` — Base design system
- `static/css/astravision.css` — Upgraded component styles
- `static/js/app.js` — Main app logic with SSE streaming pipeline
- `static/js/ui-animations.js` — Anime navbar + card animations

## Features (Post-Upgrade)
1. **Real-time SSE Pipeline** — Live progress stages: Upload → Detect → Extract → Search → Analyze
2. **Hybrid Similarity Scoring** — Weighted combination of feature (65%), color histogram (25%), texture (10%)
3. **3D Embedding Space** — Three.js visualization of result vectors (PCA reduced to 3D)
4. **Comparison Modal** — Side-by-side image reveal slider with similarity breakdown bars
5. **Feedback System** — Thumbs up/down on each result, stored in SQLite
6. **Search History** — Per-user history of past searches with metadata
7. **Grad-CAM Toggle** — Real-time heatmap overlay on results
8. **Multi-Object Deep Scan** — Click bounding box to crop & re-search
9. **/api/explain** — Returns AI similarity explanation + breakdown

## API Endpoints
- `POST /api/stream-search` — SSE streaming search pipeline (upload + detect + search)
- `POST /api/detect` — YOLOv8 object detection only
- `POST /api/search` — Traditional (non-streaming) similarity search
- `POST /api/explain` — Similarity explanation with breakdown
- `POST /api/feedback` — Submit thumbs up/down rating
- `GET /api/history` — User's recent search history
- `GET /api/embeddings` — 3D PCA-reduced embeddings for visualization
- `POST /api/login` / `POST /api/signup` — Authentication

## Database Schema (auth.db)
- `users` — username, password hash
- `search_history` — username, query_image, result_count, processing_time, timestamp
- `feedback` — username, result_path, rating (1/-1), timestamp

## Environment Variables
- `SESSION_SECRET` — Flask session secret key (set in Replit Secrets)

## Notes
- Uses `opencv-python-headless` for server compatibility
- numpy pinned to 1.26.4 for compatibility between tensorflow, faiss-cpu, and opencv
- Dataset (Caltech-101) must be in `dataset/gallery/archive/caltech-101/` for results
- YOLOv8n model (`yolov8n.pt`) auto-downloaded on first run
- Debug mode disabled; threaded=True for concurrent SSE streams
