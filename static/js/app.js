/* === AstraVision — Visual Intelligence Platform === */

document.addEventListener('DOMContentLoaded', () => {

    /* ── DOM Refs ──────────────────────────────────────── */
    const dropArea          = document.getElementById('drop-area');
    const fileInput         = document.getElementById('fileElem');
    const previewContainer  = document.getElementById('preview-container');
    const queryPreview      = document.getElementById('query-preview');
    const bboxesContainer   = document.getElementById('bounding-boxes-container');
    const classFilterBar    = document.getElementById('class-filter-bar');
    const resultsSection    = document.getElementById('results-section');
    const resultsGrid       = document.getElementById('results-grid');
    const xaiToggle         = document.getElementById('xai-toggle');
    const yoloControls      = document.getElementById('yolo-controls');
    const tabGlobal         = document.getElementById('tab-global');
    const tabYolo           = document.getElementById('tab-yolo');
    const tabIndicator      = document.getElementById('tab-indicator');
    const roiInstruction    = document.getElementById('roi-instruction');
    const pipelineSection   = document.getElementById('pipeline-section');
    const pipelineBar       = document.getElementById('pipeline-bar');
    const pipelineMsg       = document.getElementById('pipeline-msg');
    const statsBar          = document.getElementById('stats-bar');
    const resultsSubtitle   = document.getElementById('results-subtitle');

    /* ── State ─────────────────────────────────────────── */
    let currentFilepath   = null;
    let currentQuerySrc   = null;
    let lastResults       = [];
    let lastDetections    = [];
    let activeCompareResult = null;
    let feedbackState     = {};
    let activeClassFilter = 'all';

    /* Three.js 3D state — module-level so we can dispose */
    let threeRenderer  = null;
    let threeAnimId    = null;
    let threeScene     = null;

    const stageMap = {
        uploaded:  'uploaded',
        detecting: 'detecting',
        detected:  'detecting',
        extracting:'extracting',
        searching: 'searching',
        analyzing: 'analyzing',
        complete:  'analyzing'
    };

    /* ── View Switching ────────────────────────────────── */
    document.querySelectorAll('.view-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            document.querySelectorAll('.view-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById(`view-${view}`).classList.add('active');
            if (view === 'history') loadHistory();
            if (view === 'space3d') initSpace3D();
            lucide.createIcons();
        });
    });

    /* ── Drag & Drop ───────────────────────────────────── */
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev =>
        dropArea.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); })
    );
    ['dragenter', 'dragover'].forEach(ev =>
        dropArea.addEventListener(ev, () => dropArea.classList.add('highlight'))
    );
    ['dragleave', 'drop'].forEach(ev =>
        dropArea.addEventListener(ev, () => dropArea.classList.remove('highlight'))
    );
    dropArea.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
    dropArea.addEventListener('click', e => {
        if (!e.target.closest('.custum-file-upload') && e.target !== fileInput) fileInput.click();
    });
    fileInput.addEventListener('change', function () { handleFiles(this.files); });

    function handleFiles(files) {
        if (files.length > 0) {
            previewFile(files[0]);
            runPipeline(files[0]);
        }
    }

    /* ── Image Preview ─────────────────────────────────── */
    function previewFile(file) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
            currentQuerySrc = reader.result;
            queryPreview.src = reader.result;
            previewContainer.classList.remove('hidden');
            resultsSection.classList.add('hidden');
            bboxesContainer.innerHTML = '';
            classFilterBar.innerHTML = '';
            classFilterBar.classList.add('hidden');
            roiInstruction.innerHTML = 'Scanning image for objects...';
            yoloControls.classList.add('hidden');
            document.body.classList.remove('yolo-active');
            gsap.fromTo(previewContainer, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' });
        };
    }

    /* ── Pipeline Progress UI ──────────────────────────── */
    function showPipeline() {
        pipelineSection.classList.remove('hidden');
        setPipelineProgress(0, 'Initializing pipeline...');
        ['uploaded', 'detecting', 'extracting', 'searching', 'analyzing'].forEach(s => {
            const el = document.getElementById(`stage-${s}`);
            if (el) {
                el.classList.remove('active', 'done');
                const line = el.nextElementSibling;
                if (line && line.classList.contains('stage-line')) line.classList.remove('done');
            }
        });
    }

    function hidePipeline() {
        setTimeout(() => {
            gsap.to(pipelineSection, { opacity: 0, y: -10, duration: 0.4, onComplete: () => {
                pipelineSection.classList.add('hidden');
                gsap.set(pipelineSection, { opacity: 1, y: 0 });
            }});
        }, 800);
    }

    function setPipelineProgress(pct, msg) {
        pipelineBar.style.width = pct + '%';
        pipelineMsg.textContent = msg;
    }

    function activateStage(stageName) {
        const stageId = stageMap[stageName] || stageName;
        const stages = ['uploaded', 'detecting', 'extracting', 'searching', 'analyzing'];
        const idx = stages.indexOf(stageId);
        stages.forEach((s, i) => {
            const el = document.getElementById(`stage-${s}`);
            if (!el) return;
            const line = el.nextElementSibling;
            if (i < idx) {
                el.classList.remove('active');
                el.classList.add('done');
                if (line && line.classList.contains('stage-line')) line.classList.add('done');
            } else if (i === idx) {
                el.classList.add('active');
                el.classList.remove('done');
            } else {
                el.classList.remove('active', 'done');
            }
        });
    }

    /* ── SSE Streaming Pipeline ────────────────────────── */
    async function runPipeline(file) {
        showPipeline();
        const formData = new FormData();
        formData.append('query_image', file);
        formData.append('xai_enabled', xaiToggle.checked ? 'true' : 'false');

        let response;
        try {
            response = await fetch('/api/stream-search', { method: 'POST', body: formData });
        } catch (err) {
            setPipelineProgress(0, 'Network error. Please try again.');
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            let result;
            try { result = await reader.read(); } catch (e) { break; }
            if (result.done) break;
            buffer += decoder.decode(result.value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try { handleEvent(JSON.parse(line.slice(6))); } catch (e) {}
            }
        }
    }

    function handleEvent(data) {
        activateStage(data.stage);
        setPipelineProgress(data.progress || 0, data.message || '');

        if (data.stage === 'detected' || data.stage === 'uploaded') {
            if (data.filepath) currentFilepath = data.filepath;
            if (data.boxes) {
                lastDetections = data.boxes;
                activeClassFilter = 'all';
                if (queryPreview.complete) {
                    drawBoundingBoxes(data.boxes);
                    buildClassFilter(data.boxes);
                } else {
                    queryPreview.onload = () => {
                        drawBoundingBoxes(data.boxes);
                        buildClassFilter(data.boxes);
                    };
                }
                if (data.boxes.length > 0) {
                    yoloControls.classList.remove('hidden');
                    tabGlobal.classList.add('active');
                    tabYolo.classList.remove('active');
                    if (tabIndicator) tabIndicator.style.transform = 'translateX(0%)';
                    roiInstruction.innerHTML = `Scan complete. Found <strong>${data.boxes.length}</strong> object${data.boxes.length !== 1 ? 's' : ''}. Switch to Deep Object Scan to search by region.`;
                } else {
                    roiInstruction.innerHTML = 'No objects detected. Global neural scan complete.';
                }
            }
        }

        if (data.stage === 'complete') {
            lastResults = data.results || [];
            displayResults(data.results, data);
            hidePipeline();
        }

        if (data.stage === 'error') {
            setPipelineProgress(0, `Error: ${data.message}`);
        }
    }

    /* ── Class Filter Bar ──────────────────────────────── */
    function buildClassFilter(boxes) {
        if (!boxes || boxes.length === 0) {
            classFilterBar.classList.add('hidden');
            return;
        }

        const classCount = {};
        boxes.forEach(b => {
            classCount[b.label] = (classCount[b.label] || 0) + 1;
        });

        if (Object.keys(classCount).length < 1) {
            classFilterBar.classList.add('hidden');
            return;
        }

        classFilterBar.innerHTML = '<span class="filter-label">Filter by class:</span>';
        classFilterBar.classList.remove('hidden');

        const allPill = document.createElement('button');
        allPill.className = 'class-pill active';
        allPill.dataset.cls = 'all';
        allPill.textContent = `All (${boxes.length})`;
        classFilterBar.appendChild(allPill);

        Object.entries(classCount).forEach(([cls, cnt]) => {
            const pill = document.createElement('button');
            pill.className = 'class-pill';
            pill.dataset.cls = cls;
            pill.textContent = `${cls} (${cnt})`;
            classFilterBar.appendChild(pill);
        });

        classFilterBar.querySelectorAll('.class-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                classFilterBar.querySelectorAll('.class-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                activeClassFilter = pill.dataset.cls;
                drawBoundingBoxes(lastDetections, activeClassFilter);
            });
        });
    }

    /* ── Bounding Boxes ────────────────────────────────── */
    function drawBoundingBoxes(boxes, classFilter) {
        bboxesContainer.innerHTML = '';
        if (!boxes || boxes.length === 0) return;

        const filtered = classFilter && classFilter !== 'all'
            ? boxes.filter(b => b.label === classFilter)
            : boxes;

        const rect = queryPreview.getBoundingClientRect();
        const wrapperRect = queryPreview.parentElement.getBoundingClientRect();
        bboxesContainer.style.width  = `${rect.width}px`;
        bboxesContainer.style.height = `${rect.height}px`;
        bboxesContainer.style.left   = `${rect.left - wrapperRect.left}px`;
        bboxesContainer.style.top    = `${rect.top - wrapperRect.top}px`;
        bboxesContainer.style.transform = 'none';

        const scaleX = rect.width  / queryPreview.naturalWidth;
        const scaleY = rect.height / queryPreview.naturalHeight;

        filtered.forEach((box, index) => {
            const div = document.createElement('div');
            div.className = 'bounding-box';
            div.style.left   = `${box.x1 * scaleX}px`;
            div.style.top    = `${box.y1 * scaleY}px`;
            div.style.width  = `${(box.x2 - box.x1) * scaleX}px`;
            div.style.height = `${(box.y2 - box.y1) * scaleY}px`;

            const areaPct = box.area != null ? ` · ${(box.area * 100).toFixed(0)}% area` : '';
            div.innerHTML = `<span class="box-label">${box.label} ${(box.confidence * 100).toFixed(0)}%${areaPct}</span>`;
            gsap.fromTo(div, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.3, delay: index * 0.08 });

            div.addEventListener('mouseenter', () => div.classList.add('hovered'));
            div.addEventListener('mouseleave', () => div.classList.remove('hovered'));
            div.addEventListener('click', e => {
                e.stopPropagation();
                document.querySelectorAll('.bounding-box').forEach(b => b.classList.remove('selected'));
                div.classList.add('selected');
                reRunWithCrop(box);
            });

            bboxesContainer.appendChild(div);
        });
    }

    async function reRunWithCrop(box) {
        if (!currentFilepath || !fileInput.files[0]) return;
        showPipeline();
        setPipelineProgress(20, 'Cropping region of interest...');

        const formData = new FormData();
        formData.append('query_image', fileInput.files[0]);
        formData.append('crop_data', JSON.stringify(box));
        formData.append('xai_enabled', xaiToggle.checked ? 'true' : 'false');

        try {
            const response = await fetch('/api/stream-search', { method: 'POST', body: formData });
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try { handleEvent(JSON.parse(line.slice(6))); } catch (e) {}
                }
            }
        } catch (e) {
            setPipelineProgress(0, 'Error during region search.');
        }
    }

    /* ── Display Results ───────────────────────────────── */
    function displayResults(matches, meta) {
        resultsSection.classList.remove('hidden');

        if (!matches || matches.length === 0) {
            resultsGrid.innerHTML = `
                <div class="no-results-msg">
                    <i data-lucide="search-x"></i>
                    <p>No matches found.</p>
                    <span>Make sure the dataset is indexed in <code>dataset/gallery/archive/caltech-101/</code></span>
                </div>`;
            lucide.createIcons();
            return;
        }

        if (meta && statsBar) {
            statsBar.innerHTML = `
                <div class="stat-item">
                    <span class="stat-label">Matches</span>
                    <span class="stat-value accent">${matches.length}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Processing Time</span>
                    <span class="stat-value">${meta.processing_time || '—'}s</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Top Score</span>
                    <span class="stat-value success">${matches.length > 0 ? (matches[0].similarity_score * 100).toFixed(1) + '%' : '—'}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Model</span>
                    <span class="stat-value">MobileNetV2 + FAISS</span>
                </div>`;
            if (resultsSubtitle)
                resultsSubtitle.textContent = `${matches.length} results · ${meta.processing_time}s · Hybrid Similarity (feature + color + texture)`;
        }

        resultsGrid.innerHTML = '';
        matches.forEach((match, i) => {
            const card = document.createElement('div');
            card.className = 'result-card';
            card.dataset.index = i;

            const imgPath  = match.image_path.replace(/\\/g, '/');
            const score    = match.similarity_score;
            const featScore = match.feature_similarity;
            const colScore  = match.color_similarity;
            const texScore  = match.texture_similarity;
            const rank = match.rank || (i + 1);
            const isTop = rank === 1;

            let heatmapHtml = '';
            if (match.heatmap_path) {
                heatmapHtml = `<img src="/${match.heatmap_path}" class="heatmap-img" alt="Grad-CAM">`;
            }

            const category = imgPath.includes('/') ? imgPath.split('/')[0] : '';

            card.innerHTML = `
                <div class="rank-badge${isTop ? ' top' : ''}">#${rank}</div>
                <div class="img-wrapper">
                    <img src="/dataset/${imgPath}" class="base-img" alt="Match" loading="lazy">
                    ${heatmapHtml}
                </div>
                <div class="card-footer">
                    ${category ? `<div class="result-category">${category}</div>` : ''}
                    <div class="score-row">
                        <span class="score-label">Hybrid Score</span>
                        <span class="score-value">${(score * 100).toFixed(1)}%</span>
                    </div>
                    <div class="score-bar-wrap">
                        <div class="score-bar-fill" style="width:${Math.min(score * 100, 100)}%"></div>
                    </div>
                    <div class="breakdown-mini">
                        <span class="breakdown-pill feat" title="Neural Feature Similarity">Shape: ${(featScore * 100).toFixed(0)}%</span>
                        <span class="breakdown-pill col" title="Color Histogram Similarity">Color: ${(colScore * 100).toFixed(0)}%</span>
                        <span class="breakdown-pill tex" title="Texture Similarity">Texture: ${(texScore * 100).toFixed(0)}%</span>
                    </div>
                    <div class="card-actions">
                        <button class="btn-compare" data-index="${i}">
                            <i data-lucide="columns-2"></i> Compare
                        </button>
                        <button class="btn-thumb up" data-path="${imgPath}" data-rating="1">
                            <i data-lucide="thumbs-up"></i>
                        </button>
                        <button class="btn-thumb down" data-path="${imgPath}" data-rating="-1">
                            <i data-lucide="thumbs-down"></i>
                        </button>
                    </div>
                </div>`;

            resultsGrid.appendChild(card);
        });

        lucide.createIcons();
        gsap.fromTo('.result-card',
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: 'power2.out' }
        );
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        document.querySelectorAll('.btn-compare').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                openCompareModal(matches[idx]);
            });
        });

        document.querySelectorAll('.btn-thumb').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                submitFeedback(btn.dataset.path, parseInt(btn.dataset.rating), btn);
            });
        });

        if (xaiToggle.checked) document.body.classList.add('xai-active');
    }

    /* ── XAI Toggle ────────────────────────────────────── */
    xaiToggle.addEventListener('change', function () {
        if (this.checked) document.body.classList.add('xai-active');
        else document.body.classList.remove('xai-active');
    });

    /* ── Feature Tabs ──────────────────────────────────── */
    if (tabGlobal && tabYolo) {
        tabGlobal.addEventListener('click', () => {
            tabGlobal.classList.add('active');
            tabYolo.classList.remove('active');
            if (tabIndicator) tabIndicator.style.transform = 'translateX(0%)';
            document.body.classList.remove('yolo-active');
            roiInstruction.innerHTML = 'Global scan mode. All bounding boxes shown.';
            drawBoundingBoxes(lastDetections, 'all');
        });
        tabYolo.addEventListener('click', () => {
            tabYolo.classList.add('active');
            tabGlobal.classList.remove('active');
            if (tabIndicator) tabIndicator.style.transform = 'translateX(100%)';
            document.body.classList.add('yolo-active');
            roiInstruction.innerHTML = 'Deep scan enabled. Click a bounding box to run a region-specific search.';
        });
    }

    /* ── Feedback ──────────────────────────────────────── */
    async function submitFeedback(resultPath, rating, btn) {
        const key = `${resultPath}-${rating}`;
        if (feedbackState[key]) return;
        feedbackState[key] = true;

        const siblingRating = rating === 1 ? -1 : 1;
        feedbackState[`${resultPath}-${siblingRating}`] = false;

        btn.classList.add('active');
        const sibling = btn.parentElement.querySelector(`.btn-thumb[data-rating="${siblingRating}"]`);
        if (sibling) sibling.classList.remove('active');

        try {
            await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ result_path: resultPath, rating })
            });
        } catch (e) {}
    }

    /* ── Comparison Modal ──────────────────────────────── */
    const compareModal       = document.getElementById('compare-modal');
    const compareAfter       = document.getElementById('compare-after');
    const compareDivider     = document.getElementById('compare-divider');
    const compareSlider      = document.getElementById('compare-slider');
    const compareQueryImg    = document.getElementById('compare-query-img');
    const compareResultImg   = document.getElementById('compare-result-img');
    const breakdownBars      = document.getElementById('breakdown-bars');
    const breakdownExplanation = document.getElementById('breakdown-explanation');
    const btnFeedbackUp      = document.getElementById('btn-feedback-up');
    const btnFeedbackDown    = document.getElementById('btn-feedback-down');
    const modalClose         = document.getElementById('modal-close');

    function openCompareModal(match) {
        activeCompareResult = match;
        compareQueryImg.src  = currentQuerySrc || '';
        compareResultImg.src = `/dataset/${match.image_path}`;
        compareSlider.value  = 50;
        updateCompareSlider(50);
        renderBreakdown(match);
        fetchExplanation(match);
        btnFeedbackUp.classList.remove('active');
        btnFeedbackDown.classList.remove('active');
        compareModal.classList.remove('hidden');
        gsap.fromTo('.modal-panel', { scale: 0.95, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'power2.out' });
        lucide.createIcons();
    }

    function updateCompareSlider(val) {
        compareAfter.style.clipPath = `inset(0 ${100 - val}% 0 0)`;
        compareDivider.style.left   = val + '%';
    }

    compareSlider.addEventListener('input', () => updateCompareSlider(compareSlider.value));

    function renderBreakdown(match) {
        const feat = Math.round((match.feature_similarity || 0) * 100);
        const col  = Math.round((match.color_similarity   || 0) * 100);
        const tex  = Math.round((match.texture_similarity || 0) * 100);

        breakdownBars.innerHTML = `
            <div class="breakdown-row">
                <span class="breakdown-name">Shape / Structure</span>
                <div class="breakdown-bar-wrap">
                    <div class="breakdown-bar-fill shape" style="width:${feat}%"></div>
                </div>
                <span class="breakdown-pct">${feat}%</span>
            </div>
            <div class="breakdown-row">
                <span class="breakdown-name">Color Palette</span>
                <div class="breakdown-bar-wrap">
                    <div class="breakdown-bar-fill color" style="width:${col}%"></div>
                </div>
                <span class="breakdown-pct">${col}%</span>
            </div>
            <div class="breakdown-row">
                <span class="breakdown-name">Texture Detail</span>
                <div class="breakdown-bar-wrap">
                    <div class="breakdown-bar-fill texture" style="width:${tex}%"></div>
                </div>
                <span class="breakdown-pct">${tex}%</span>
            </div>`;
        breakdownExplanation.textContent = 'Fetching AI explanation...';
    }

    async function fetchExplanation(match) {
        try {
            const res = await fetch('/api/explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query_path: currentFilepath || '',
                    result_path: match.image_path,
                    feature_similarity: match.feature_similarity,
                    color_similarity:   match.color_similarity,
                    texture_similarity: match.texture_similarity
                })
            });
            const data = await res.json();
            if (data.explanation) breakdownExplanation.textContent = data.explanation;
        } catch (e) {
            breakdownExplanation.textContent = 'Unable to fetch explanation.';
        }
    }

    modalClose.addEventListener('click', () => {
        gsap.to('.modal-panel', { scale: 0.95, opacity: 0, duration: 0.2, onComplete: () => {
            compareModal.classList.add('hidden');
            gsap.set('.modal-panel', { scale: 1, opacity: 1 });
        }});
    });
    compareModal.addEventListener('click', e => { if (e.target === compareModal) modalClose.click(); });

    btnFeedbackUp.addEventListener('click', () => {
        if (activeCompareResult) {
            submitFeedback(activeCompareResult.image_path, 1, btnFeedbackUp);
            btnFeedbackDown.classList.remove('active');
        }
    });
    btnFeedbackDown.addEventListener('click', () => {
        if (activeCompareResult) {
            submitFeedback(activeCompareResult.image_path, -1, btnFeedbackDown);
            btnFeedbackUp.classList.remove('active');
        }
    });

    /* ── History ───────────────────────────────────────── */
    async function loadHistory() {
        const grid = document.getElementById('history-grid');
        grid.innerHTML = '<div class="history-loading"><div class="spinner"></div></div>';

        try {
            const res  = await fetch('/api/history');
            const data = await res.json();
            const items = data.history || [];

            if (items.length === 0) {
                grid.innerHTML = '<div class="history-empty">No search history yet. Run a visual search to get started.</div>';
                return;
            }

            grid.innerHTML = '';
            items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'history-card';
                const ts = new Date(item.timestamp + 'Z').toLocaleString();
                card.innerHTML = `
                    <div class="history-card-top">
                        <div class="history-icon"><i data-lucide="image"></i></div>
                        <div class="history-filename">${item.query_image}</div>
                        <button class="history-delete-btn" data-id="${item.id}" title="Delete">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                    <div class="history-meta">
                        <div class="history-meta-item">
                            <span class="history-meta-label">Results</span>
                            <span class="history-meta-value">${item.result_count}</span>
                        </div>
                        <div class="history-meta-item">
                            <span class="history-meta-label">Time</span>
                            <span class="history-meta-value">${(item.processing_time || 0).toFixed(2)}s</span>
                        </div>
                        <div class="history-meta-item">
                            <span class="history-meta-label">Date</span>
                            <span class="history-meta-value history-date">${ts}</span>
                        </div>
                    </div>`;
                grid.appendChild(card);
            });

            lucide.createIcons();

            grid.querySelectorAll('.history-delete-btn').forEach(btn => {
                btn.addEventListener('click', async e => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    try {
                        await fetch(`/api/history/${id}`, { method: 'DELETE' });
                        const card = btn.closest('.history-card');
                        gsap.to(card, { opacity: 0, height: 0, marginBottom: 0, duration: 0.3, onComplete: () => card.remove() });
                    } catch (err) {}
                });
            });

        } catch (e) {
            grid.innerHTML = '<div class="history-empty">Failed to load history.</div>';
        }
    }

    /* ── 3D Embedding Space ─────────────────────────────── */
    async function initSpace3D() {
        const empty   = document.getElementById('space3d-empty');
        const canvas  = document.getElementById('space3d-canvas');
        const tooltip = document.getElementById('space3d-tooltip');

        let data;
        try {
            const res = await fetch('/api/embeddings');
            data = await res.json();
        } catch (e) { return; }

        if (!data.points || data.points.length < 2) {
            empty.style.display  = 'flex';
            canvas.style.display = 'none';
            if (tooltip) tooltip.style.display = 'none';
            return;
        }

        empty.style.display  = 'none';
        canvas.style.display = 'block';

        /* Dispose any existing renderer before creating a new one */
        if (threeAnimId)    cancelAnimationFrame(threeAnimId);
        if (threeRenderer)  { threeRenderer.dispose(); threeRenderer = null; }

        render3D(canvas, data, tooltip);
    }

    function render3D(canvas, data, tooltip) {
        const container = document.getElementById('space3d-container');
        const W = container.clientWidth  || 800;
        const H = container.clientHeight || 500;

        threeScene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(60, W / H, 0.01, 100);
        camera.position.set(0, 0, 3);

        threeRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        threeRenderer.setSize(W, H);
        threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const points     = data.points      || [];
        const scores     = data.scores      || [];
        const imagePaths = data.image_paths || [];
        const scale      = 2;

        /* Central pivot group — all meshes live inside it */
        const pivot = new THREE.Group();
        threeScene.add(pivot);

        const allMeshes = [];

        points.forEach((pt, i) => {
            const isQuery = i === 0;
            const score   = scores[i] || 0;

            let color;
            if (isQuery) {
                color = new THREE.Color(1, 1, 1);
            } else if (score > 0.7) {
                color = new THREE.Color(0.06, 0.73, 0.51);   /* green */
            } else if (score > 0.4) {
                color = new THREE.Color(0.23, 0.51, 0.96);   /* blue */
            } else {
                color = new THREE.Color(0.96, 0.62, 0.04);   /* orange */
            }

            const size = isQuery ? 0.14 : 0.055 + score * 0.05;
            const geom = new THREE.SphereGeometry(size, 20, 20);
            const mat  = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: isQuery ? 1 : 0.85 });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.set(pt[0] * scale, pt[1] * scale, pt[2] * scale);
            mesh.userData = { isQuery, score, imagePath: imagePaths[i] || '', index: i };
            pivot.add(mesh);
            allMeshes.push(mesh);

            /* Glow halo for query node */
            if (isQuery) {
                const glowGeom = new THREE.SphereGeometry(size * 2.8, 20, 20);
                const glowMat  = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.07 });
                const glow     = new THREE.Mesh(glowGeom, glowMat);
                glow.position.copy(mesh.position);
                pivot.add(glow);
            }
        });

        /* ── Drag controls ───────────────────────────── */
        let isDragging = false;
        let prevMouse  = { x: 0, y: 0 };
        let rotX = 0, rotY = 0;

        canvas.addEventListener('mousedown', e => {
            isDragging = true;
            prevMouse = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
        });
        window.addEventListener('mouseup', () => {
            isDragging = false;
            canvas.style.cursor = 'grab';
        });
        window.addEventListener('mousemove', e => {
            if (!isDragging) return;
            rotY += (e.clientX - prevMouse.x) * 0.005;
            rotX += (e.clientY - prevMouse.y) * 0.005;
            prevMouse = { x: e.clientX, y: e.clientY };
        });
        canvas.addEventListener('wheel', e => {
            e.preventDefault();
            camera.position.z = Math.max(0.5, Math.min(8, camera.position.z + e.deltaY * 0.005));
        }, { passive: false });
        canvas.style.cursor = 'grab';

        /* ── Raycasting for hover / click ────────────── */
        const raycaster   = new THREE.Raycaster();
        const mouse2D     = new THREE.Vector2();
        let hoveredMesh   = null;

        canvas.addEventListener('mousemove', e => {
            if (isDragging) return;
            const rect = canvas.getBoundingClientRect();
            mouse2D.x = ((e.clientX - rect.left) / rect.width)  *  2 - 1;
            mouse2D.y = ((e.clientY - rect.top)  / rect.height) * -2 + 1;

            raycaster.setFromCamera(mouse2D, camera);
            const hits = raycaster.intersectObjects(allMeshes);

            if (hits.length > 0) {
                const hit = hits[0].object;
                if (hit !== hoveredMesh) {
                    if (hoveredMesh) hoveredMesh.material.opacity = hoveredMesh.userData.isQuery ? 1 : 0.85;
                    hoveredMesh = hit;
                    hit.material.opacity = 1;
                }
                canvas.style.cursor = 'pointer';
                if (tooltip) {
                    const ud = hit.userData;
                    const label = ud.isQuery
                        ? '<strong>Query Image</strong>'
                        : `<strong>Score: ${(ud.score * 100).toFixed(1)}%</strong>`;
                    const fname = ud.imagePath ? ud.imagePath.split('/').pop() : '';
                    tooltip.innerHTML  = `${label}${fname ? '<br><span>' + fname + '</span>' : ''}`;
                    tooltip.style.left = (e.clientX - canvas.getBoundingClientRect().left + 14) + 'px';
                    tooltip.style.top  = (e.clientY - canvas.getBoundingClientRect().top  - 10) + 'px';
                    tooltip.style.display = 'block';
                }
            } else {
                if (hoveredMesh) {
                    hoveredMesh.material.opacity = hoveredMesh.userData.isQuery ? 1 : 0.85;
                    hoveredMesh = null;
                }
                canvas.style.cursor = 'grab';
                if (tooltip) tooltip.style.display = 'none';
            }
        });

        canvas.addEventListener('click', () => {
            if (!hoveredMesh) return;
            const ud = hoveredMesh.userData;
            if (!ud.isQuery && ud.imagePath && lastResults.length > 0) {
                const match = lastResults.find(r => r.image_path === ud.imagePath);
                if (match) openCompareModal(match);
            }
        });

        /* ── Animation loop ──────────────────────────── */
        function loop() {
            threeAnimId = requestAnimationFrame(loop);
            if (!isDragging) rotY += 0.004;
            pivot.rotation.y = rotY;
            pivot.rotation.x = rotX;
            threeRenderer.render(threeScene, camera);
        }
        loop();

        /* ── Responsive resize ───────────────────────── */
        const ro = new ResizeObserver(() => {
            const nW = container.clientWidth;
            const nH = container.clientHeight;
            if (nW && nH) {
                camera.aspect = nW / nH;
                camera.updateProjectionMatrix();
                threeRenderer.setSize(nW, nH);
            }
        });
        ro.observe(container);
    }

    /* ── Window resize — redraw bounding boxes ──────────── */
    window.addEventListener('resize', () => {
        if (lastDetections.length > 0 && queryPreview.complete) {
            drawBoundingBoxes(lastDetections, activeClassFilter);
        }
    });

});
