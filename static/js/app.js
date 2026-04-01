document.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('fileElem');
    const previewContainer = document.getElementById('preview-container');
    const queryPreview = document.getElementById('query-preview');
    const bboxesContainer = document.getElementById('bounding-boxes-container');
    const loader = document.getElementById('loader');
    const resultsSection = document.getElementById('results-section');
    const resultsGrid = document.getElementById('results-grid');

    const xaiToggle = document.getElementById('xai-toggle');
    const yoloControls = document.getElementById('yolo-controls');

    // Feature Tabs UI
    const tabGlobal = document.getElementById('tab-global');
    const tabYolo = document.getElementById('tab-yolo');
    const tabIndicator = document.getElementById('tab-indicator');
    const roiInstruction = document.getElementById('roi-instruction');

    let currentFilepath = null;

    // 1. Drag & Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('highlight'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('highlight'), false);
    });

    dropArea.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files), false);
    dropArea.addEventListener('click', (e) => {
        // Prevent double trigger if clicked directly on the label, which natively triggers the input
        if (!e.target.closest('.custum-file-upload') && e.target !== fileInput) {
            fileInput.click();
        }
    });
    fileInput.addEventListener('change', function () { handleFiles(this.files) });

    function handleFiles(files) {
        if (files.length > 0) {
            previewFile(files[0]);
            detectObjects(files[0]);
        }
    }



    // 2. Premium Preview Animation
    function previewFile(file) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = function () {
            queryPreview.src = reader.result;
            previewContainer.classList.remove('hidden');
            resultsSection.classList.add('hidden');
            bboxesContainer.innerHTML = '';
            roiInstruction.innerHTML = 'Scanning image for objects...';

            yoloControls.classList.add('hidden');
            document.body.classList.remove('yolo-active');



            // Subtle fade up animation
            gsap.fromTo(previewContainer, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" });
        }
    }

    // 3. Detection
    async function detectObjects(file) {
        loader.classList.remove('hidden');


        const formData = new FormData();
        formData.append('query_image', file);

        try {
            const detectResponse = await fetch('/api/detect', { method: 'POST', body: formData });
            const detectData = await detectResponse.json();

            if (detectData.success) {
                currentFilepath = detectData.filepath;

                // RESTORE ORIGINAL LOGIC: Auto-search the full image immediately
                performSearch(currentFilepath, null);

                // Ensure image is loaded before drawing boxes
                if (queryPreview.complete) {
                    drawBoundingBoxes(detectData.boxes);
                } else {
                    queryPreview.onload = () => drawBoundingBoxes(detectData.boxes);
                }

                if (detectData.boxes.length > 0) {
                    yoloControls.classList.remove('hidden');

                    // Always default to Global Search tab active on first scan
                    tabGlobal.classList.add('active');
                    tabYolo.classList.remove('active');
                    tabIndicator.style.transform = 'translateX(0%)';

                    roiInstruction.innerHTML = 'Scan complete. Switch to Deep Object Scan to search by region.';
                } else {
                    roiInstruction.innerHTML = 'Global neural search complete.';
                }
            } else {
                loader.classList.add('hidden');
                console.error("Detection Failed:", detectData.error);
            }
        } catch (error) {
            console.error("Neural Scan Error:", error);
            loader.classList.add('hidden');

        }
    }

    // 4. Draw Boxes
    function drawBoundingBoxes(boxes) {
        bboxesContainer.innerHTML = '';
        if (!boxes || boxes.length === 0) return;

        // MATCH CONTAINER TO IMAGE EXACTLY
        const rect = queryPreview.getBoundingClientRect();
        const wrapperRect = queryPreview.parentElement.getBoundingClientRect();

        // Offset relative to the relative wrapper
        const offsetLeft = rect.left - wrapperRect.left;
        const offsetTop = rect.top - wrapperRect.top;

        bboxesContainer.style.width = `${rect.width}px`;
        bboxesContainer.style.height = `${rect.height}px`;
        bboxesContainer.style.left = `${offsetLeft}px`;
        bboxesContainer.style.top = `${offsetTop}px`;
        bboxesContainer.style.transform = 'none'; // Remove any default centering

        const scaleX = rect.width / queryPreview.naturalWidth;
        const scaleY = rect.height / queryPreview.naturalHeight;

        boxes.forEach((box, index) => {
            const div = document.createElement('div');
            div.className = 'bounding-box';

            div.style.left = `${box.x1 * scaleX}px`;
            div.style.top = `${box.y1 * scaleY}px`;
            div.style.width = `${(box.x2 - box.x1) * scaleX}px`;
            div.style.height = `${(box.y2 - box.y1) * scaleY}px`;

            div.innerHTML = `<span class="box-label">${box.label} ${(box.confidence * 100).toFixed(0)}%</span>`;

            // Clean fade in for boxes
            gsap.fromTo(div, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.3, delay: index * 0.1 });

            div.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.bounding-box').forEach(b => b.classList.remove('selected'));
                div.classList.add('selected');
                performSearch(currentFilepath, box);
            });

            bboxesContainer.appendChild(div);
        });
    }

    // Feature Tabs Event Listeners
    if (tabGlobal && tabYolo) {
        tabGlobal.addEventListener('click', () => {
            tabGlobal.classList.add('active');
            tabYolo.classList.remove('active');
            tabIndicator.style.transform = 'translateX(0%)';
            document.body.classList.remove('yolo-active');
            roiInstruction.innerHTML = 'Scan complete. Switch to Deep Object Scan to search by region.';
            // Run global search when switching back
            if (currentFilepath) performSearch(currentFilepath, null);
        });

        tabYolo.addEventListener('click', () => {
            tabYolo.classList.add('active');
            tabGlobal.classList.remove('active');
            tabIndicator.style.transform = 'translateX(100%)';
            document.body.classList.add('yolo-active');
            roiInstruction.innerHTML = 'Deep scan enabled. Select a bounding box to perform a region-specific search.';
        });
    }

    // 5. Search
    async function performSearch(filepath, cropCoords) {
        loader.classList.remove('hidden');
        if (!cropCoords) resultsSection.classList.add('hidden'); // Clear results only for fresh searches

        const formData = new FormData();
        formData.append('filepath', filepath);
        formData.append('xai_enabled', xaiToggle.checked);
        if (cropCoords) formData.append('crop_data', JSON.stringify(cropCoords));

        try {
            const response = await fetch('/api/search', { method: 'POST', body: formData });
            const data = await response.json();

            loader.classList.add('hidden');
            if (data.success) {
                displayResults(data.matches);
            }
        } catch (error) {
            console.error("Search Error:", error);
            loader.classList.add('hidden');
        }
    }

    // 6. Display Results
    function displayResults(matches) {
        resultsSection.classList.remove('hidden');
        resultsGrid.innerHTML = '';

        matches.forEach((match) => {
            const card = document.createElement('div');
            card.className = 'result-card';
            const imgPath = match.image_path.replace(/\\/g, '/');

            let heatmapImg = '';
            if (match.heatmap_path) {
                const heatmapPath = match.heatmap_path.replace(/\\/g, '/');
                heatmapImg = `<img src="/${heatmapPath}" alt="XAI Heatmap" class="heatmap-img">`;
            }

            card.innerHTML = `
                <div class="img-wrapper">
                    <img src="/dataset/${imgPath}" alt="Similar Image" class="base-img">
                    ${heatmapImg}
                </div>
                <div class="score-container">
                    <span class="score-label">Similarity</span>
                    <span class="score-value">${(match.similarity_score * 100).toFixed(1)}%</span>
                </div>
            `;
            resultsGrid.appendChild(card);
        });

        // Elegant cascading fade-up
        gsap.fromTo(".result-card",
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: "power2.out" }
        );

        // Scroll to results smoothly
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    xaiToggle.addEventListener('change', function () {
        if (this.checked) document.body.classList.add('xai-active');
        else document.body.classList.remove('xai-active');
        // Handle window resize for bounding boxes
        window.addEventListener('resize', () => {
            if (bboxesContainer.innerHTML !== '') {
                // Re-fetch or re-use detection data if possible, for now just clear to avoid misalignment
                // A better way is to store the last boxes and re-draw them
            }
        });

        // Store last detections for responsive redraw
        let lastDetections = [];

        // Modified draw function to store data
        const originalDraw = drawBoundingBoxes;
        drawBoundingBoxes = function (boxes) {
            lastDetections = boxes;
            originalDraw(boxes);
        };

        window.addEventListener('resize', () => {
            if (lastDetections.length > 0) {
                drawBoundingBoxes(lastDetections);
            }
        });
    });
});