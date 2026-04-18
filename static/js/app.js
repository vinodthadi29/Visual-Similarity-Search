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
    const xaiTogglePre      = document.getElementById('xai-toggle-pre');
    const gradcamPanel      = document.getElementById('gradcam-panel');
    const gradcamImg        = document.getElementById('gradcam-img');
    const gradcamPlaceholder= document.getElementById('gradcam-placeholder');
    const gradcamSpinner    = document.getElementById('gradcam-spinner');
    const modalDownloadBtn  = document.getElementById('modal-download-btn');
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
    const sortSelect        = document.getElementById('sort-select');
    const exportBtn         = document.getElementById('export-btn');
    const colorPaletteStrip = document.getElementById('color-palette-strip');
    const paletteSatches    = document.getElementById('palette-swatches');

    /* ── State ─────────────────────────────────────────── */
    let currentFilepath   = null;
    let currentQuerySrc   = null;
    let lastResults       = [];
    let lastMeta          = {};
    let lastDetections    = [];
    let activeCompareResult = null;
    let feedbackState     = {};
    let activeClassFilter = 'all';
    let lastDominantColors = [];

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
            colorPaletteStrip.classList.add('hidden');
            roiInstruction.innerHTML = 'Scanning image for objects...';
            yoloControls.classList.add('hidden');
            document.body.classList.remove('yolo-active');
            gsap.fromTo(previewContainer, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' });

            /* Extract dominant colors from query image */
            queryPreview.onload = () => {
                lastDominantColors = extractDominantColors(queryPreview, 6);
                renderPaletteStrip(lastDominantColors);
            };
            if (queryPreview.complete && queryPreview.naturalWidth > 0) {
                lastDominantColors = extractDominantColors(queryPreview, 6);
                renderPaletteStrip(lastDominantColors);
            }
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
        formData.append('xai_enabled', (xaiToggle && xaiToggle.checked) ? 'true' : 'false');

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
                const doDraw = () => {
                    if (queryPreview.naturalWidth > 0) {
                        drawBoundingBoxes(data.boxes);
                        buildClassFilter(data.boxes);
                    } else {
                        queryPreview.onload = () => {
                            drawBoundingBoxes(data.boxes);
                            buildClassFilter(data.boxes);
                        };
                    }
                };
                if (queryPreview.complete) {
                    requestAnimationFrame(doDraw);
                } else {
                    queryPreview.onload = () => {
                        requestAnimationFrame(() => {
                            drawBoundingBoxes(data.boxes);
                            buildClassFilter(data.boxes);
                        });
                    };
                }
                if (data.boxes.length > 0) {
                    yoloControls.classList.remove('hidden');
                    tabGlobal.classList.add('active');
                    tabYolo.classList.remove('active');
                    if (tabIndicator) tabIndicator.style.transform = 'translateX(0%)';
                    roiInstruction.innerHTML = `Scan complete — found <strong>${data.boxes.length}</strong> object${data.boxes.length !== 1 ? 's' : ''}. Click any box to search that region.`;
                } else {
                    yoloControls.classList.add('hidden');
                    roiInstruction.innerHTML = 'No objects detected. Global neural scan complete.';
                }
            }
        }

        if (data.stage === 'complete') {
            lastResults = data.results || [];
            lastMeta    = data;
            displayResults(lastResults, data);
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
        boxes.forEach(b => { classCount[b.label] = (classCount[b.label] || 0) + 1; });

        if (Object.keys(classCount).length < 1) { classFilterBar.classList.add('hidden'); return; }

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
        if (!queryPreview.naturalWidth || !queryPreview.naturalHeight) return;

        const filtered = classFilter && classFilter !== 'all'
            ? boxes.filter(b => b.label === classFilter)
            : boxes;

        const dispW = queryPreview.offsetWidth  || queryPreview.getBoundingClientRect().width;
        const dispH = queryPreview.offsetHeight || queryPreview.getBoundingClientRect().height;

        const scaleX = dispW / queryPreview.naturalWidth;
        const scaleY = dispH / queryPreview.naturalHeight;

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
        formData.append('xai_enabled', (xaiToggle && xaiToggle.checked) ? 'true' : 'false');

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
                    <span class="stat-label">Engine</span>
                    <span class="stat-value">MobileNetV2 + FAISS</span>
                </div>`;
            if (resultsSubtitle)
                resultsSubtitle.textContent = `${matches.length} results · ${meta.processing_time}s · Hybrid Similarity`;
        }

        renderResultCards(matches);
    }

    function renderResultCards(matches) {
        resultsGrid.innerHTML = '';
        matches.forEach((match, i) => {
            const card = document.createElement('div');
            card.className = 'result-card';
            card.dataset.index = i;

            const imgPath   = match.image_path.replace(/\\/g, '/');
            const score     = match.similarity_score;
            const featScore = match.feature_similarity;
            const colScore  = match.color_similarity;
            const texScore  = match.texture_similarity;
            const rank      = match.rank || (i + 1);
            const isTop     = rank === 1;
            const category  = imgPath.includes('/') ? imgPath.split('/')[0] : '';

            let heatmapHtml = '';
            if (match.heatmap_path) {
                heatmapHtml = `<img src="/${match.heatmap_path}" class="heatmap-img" alt="Grad-CAM">`;
            }

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
                        <button class="btn-download" data-path="${imgPath}" title="Download image">
                            <i data-lucide="download"></i>
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
                openCompareModal(lastResults[idx]);
            });
        });

        document.querySelectorAll('.btn-thumb').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                submitFeedback(btn.dataset.path, parseInt(btn.dataset.rating), btn);
            });
        });

        document.querySelectorAll('.btn-download').forEach(btn => {
            btn.addEventListener('click', async e => {
                e.stopPropagation();
                const path = btn.dataset.path;
                try {
                    const res  = await fetch(`/dataset/${path}`);
                    const blob = await res.blob();
                    const a    = document.createElement('a');
                    a.href     = URL.createObjectURL(blob);
                    a.download = path.split('/').pop() || 'image.jpg';
                    a.click();
                    URL.revokeObjectURL(a.href);
                    gsap.fromTo(btn, { scale: 0.8 }, { scale: 1, duration: 0.4, ease: 'elastic.out(1.2, 0.5)' });
                } catch(err) {}
            });
        });

        if (xaiToggle && xaiToggle.checked) document.body.classList.add('xai-active');
    }

    /* ── Sort Results ──────────────────────────────────── */
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            if (!lastResults.length) return;
            const key = sortSelect.value;
            const sorted = [...lastResults].sort((a, b) => {
                if (key === 'score')    return b.similarity_score - a.similarity_score;
                if (key === 'color')    return b.color_similarity - a.color_similarity;
                if (key === 'texture')  return b.texture_similarity - a.texture_similarity;
                if (key === 'category') {
                    const ca = (a.image_path.split('/')[0] || '').toLowerCase();
                    const cb = (b.image_path.split('/')[0] || '').toLowerCase();
                    return ca.localeCompare(cb);
                }
                return 0;
            });
            renderResultCards(sorted);
        });
    }

    /* ── Export Results ────────────────────────────────── */
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (!lastResults.length) return;
            const exportData = {
                exported_at: new Date().toISOString(),
                query_image: currentFilepath || 'unknown',
                processing_time: lastMeta.processing_time || null,
                total_results: lastResults.length,
                results: lastResults.map((r, i) => ({
                    rank: i + 1,
                    image_path: r.image_path,
                    category: r.image_path.split('/')[0] || '',
                    hybrid_score: parseFloat((r.similarity_score * 100).toFixed(2)),
                    feature_similarity: parseFloat((r.feature_similarity * 100).toFixed(2)),
                    color_similarity: parseFloat((r.color_similarity * 100).toFixed(2)),
                    texture_similarity: parseFloat((r.texture_similarity * 100).toFixed(2))
                }))
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `astravision_results_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);

            gsap.fromTo(exportBtn, { scale: 0.9 }, { scale: 1, duration: 0.3, ease: 'elastic.out(1.2,0.5)' });
        });
    }

    /* ── XAI Toggle (sync both pre-search and results toggles) ── */
    function applyXaiState(checked) {
        if (checked) document.body.classList.add('xai-active');
        else document.body.classList.remove('xai-active');
        if (xaiToggle)    xaiToggle.checked    = checked;
        if (xaiTogglePre) xaiTogglePre.checked = checked;
    }

    if (xaiToggle) xaiToggle.addEventListener('change', function () { applyXaiState(this.checked); });
    if (xaiTogglePre) {
        xaiTogglePre.addEventListener('change', function () { applyXaiState(this.checked); });
    }

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
        /* Reset Grad-CAM panel */
        if (gradcamImg)        { gradcamImg.style.display = 'none'; gradcamImg.src = ''; }
        if (gradcamPlaceholder){ gradcamPlaceholder.style.display = 'flex'; }
        if (gradcamSpinner)    { gradcamSpinner.style.display = 'inline-block'; }

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

            /* Show Grad-CAM heatmap in modal */
            if (data.heatmap_path && gradcamImg && gradcamPlaceholder) {
                gradcamImg.onload = () => {
                    gradcamPlaceholder.style.display = 'none';
                    gradcamImg.style.display = 'block';
                    if (gradcamSpinner) gradcamSpinner.style.display = 'none';
                    gsap.fromTo(gradcamImg, { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' });
                };
                gradcamImg.onerror = () => {
                    gradcamPlaceholder.innerHTML = '<i data-lucide="alert-circle"></i><span>Heatmap unavailable</span>';
                    if (gradcamSpinner) gradcamSpinner.style.display = 'none';
                    lucide.createIcons();
                };
                gradcamImg.src = '/' + data.heatmap_path;
            } else {
                if (gradcamPlaceholder) gradcamPlaceholder.innerHTML = '<i data-lucide="info"></i><span>Heatmap generated on next search with XAI enabled</span>';
                if (gradcamSpinner) gradcamSpinner.style.display = 'none';
                lucide.createIcons();
            }
        } catch (e) {
            breakdownExplanation.textContent = 'Unable to fetch explanation.';
            if (gradcamPlaceholder) gradcamPlaceholder.innerHTML = '<i data-lucide="wifi-off"></i><span>Connection error</span>';
            if (gradcamSpinner) gradcamSpinner.style.display = 'none';
            lucide.createIcons();
        }
    }

    function closeModal() {
        gsap.to('.modal-panel', { scale: 0.95, opacity: 0, duration: 0.2, onComplete: () => {
            compareModal.classList.add('hidden');
            gsap.set('.modal-panel', { scale: 1, opacity: 1 });
        }});
    }

    modalClose.addEventListener('click', closeModal);
    compareModal.addEventListener('click', e => { if (e.target === compareModal) closeModal(); });

    /* Keyboard shortcuts */
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !compareModal.classList.contains('hidden')) closeModal();
        if (e.key === 'Enter' && document.activeElement === document.body && !fileInput.files.length) fileInput.click();
    });

    /* Download result image from modal */
    if (modalDownloadBtn) {
        modalDownloadBtn.addEventListener('click', async () => {
            if (!activeCompareResult) return;
            const url = `/dataset/${activeCompareResult.image_path}`;
            try {
                const res  = await fetch(url);
                const blob = await res.blob();
                const a    = document.createElement('a');
                a.href     = URL.createObjectURL(blob);
                a.download = activeCompareResult.image_path.split('/').pop() || 'result.jpg';
                a.click();
                URL.revokeObjectURL(a.href);
                gsap.fromTo(modalDownloadBtn, { scale: 0.85 }, { scale: 1, duration: 0.4, ease: 'elastic.out(1.2, 0.5)' });
            } catch(e) {}
        });
    }

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

    /* ── Color Palette (browser-side canvas extraction) ── */
    function extractDominantColors(imgEl, numColors) {
        try {
            const canvas = document.createElement('canvas');
            const SIZE   = 80;
            canvas.width  = SIZE;
            canvas.height = SIZE;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imgEl, 0, 0, SIZE, SIZE);
            const pixels = ctx.getImageData(0, 0, SIZE, SIZE).data;

            /* Quantize to 5-bit colors and count occurrences */
            const buckets = {};
            for (let i = 0; i < pixels.length; i += 4) {
                const r = pixels[i]   & 0xF8;
                const g = pixels[i+1] & 0xF8;
                const b = pixels[i+2] & 0xF8;
                const a = pixels[i+3];
                if (a < 128) continue;
                const key = `${r},${g},${b}`;
                buckets[key] = (buckets[key] || 0) + 1;
            }

            /* Pick top N colors, skip near-black and near-white */
            const sorted = Object.entries(buckets)
                .sort((a, b) => b[1] - a[1])
                .filter(([key]) => {
                    const [r,g,b] = key.split(',').map(Number);
                    const lum = 0.299*r + 0.587*g + 0.114*b;
                    return lum > 15 && lum < 240;
                })
                .slice(0, numColors * 6);

            /* De-duplicate by min distance */
            const result = [];
            for (const [key] of sorted) {
                const [r,g,b] = key.split(',').map(Number);
                let tooClose = false;
                for (const [pr,pg,pb] of result) {
                    const dist = Math.sqrt((r-pr)**2 + (g-pg)**2 + (b-pb)**2);
                    if (dist < 40) { tooClose = true; break; }
                }
                if (!tooClose) {
                    result.push([r,g,b]);
                    if (result.length >= numColors) break;
                }
            }
            return result;
        } catch (e) {
            return [];
        }
    }

    function colorToHex(r, g, b) {
        return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
    }

    function renderPaletteStrip(colors) {
        if (!colors || colors.length === 0) return;
        paletteSatches.innerHTML = '';
        colors.forEach(([r,g,b]) => {
            const hex = colorToHex(r,g,b);
            const swatch = document.createElement('div');
            swatch.className = 'palette-swatch';
            swatch.style.background = hex;
            swatch.title = hex;
            swatch.addEventListener('click', () => {
                navigator.clipboard?.writeText(hex).catch(()=>{});
                swatch.classList.add('copied');
                setTimeout(() => swatch.classList.remove('copied'), 1000);
            });
            paletteSatches.appendChild(swatch);
        });
        colorPaletteStrip.classList.remove('hidden');
        gsap.fromTo('.palette-swatch', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, stagger: 0.06, ease: 'back.out(1.7)' });
    }

    /* ── History ───────────────────────────────────────── */
    async function loadHistory() {
        const grid    = document.getElementById('history-grid');
        const summary = document.getElementById('history-summary');
        grid.innerHTML = '<div class="history-loading"><div class="spinner"></div></div>';
        if (summary) summary.classList.add('hidden');

        try {
            const res  = await fetch('/api/history');
            if (res.status === 401) {
                grid.innerHTML = '<div class="history-empty"><i data-lucide="lock"></i><p>Please log in to view history.</p></div>';
                lucide.createIcons();
                return;
            }
            const data  = await res.json();
            const items = data.history || [];

            if (items.length === 0) {
                grid.innerHTML = '<div class="history-empty"><i data-lucide="clock"></i><p>No search history yet.</p><span>Run a visual search to get started.</span></div>';
                lucide.createIcons();
                return;
            }

            /* Summary stats */
            if (summary) {
                const totalTime = items.reduce((s, i) => s + (i.processing_time || 0), 0);
                const avgTime   = (totalTime / items.length).toFixed(2);
                const totalRes  = items.reduce((s, i) => s + (i.result_count || 0), 0);
                summary.innerHTML = `
                    <div class="hsumm-item"><span class="hsumm-val">${items.length}</span><span class="hsumm-label">Searches</span></div>
                    <div class="hsumm-item"><span class="hsumm-val">${avgTime}s</span><span class="hsumm-label">Avg Time</span></div>
                    <div class="hsumm-item"><span class="hsumm-val">${totalRes}</span><span class="hsumm-label">Total Results</span></div>`;
                summary.classList.remove('hidden');
            }

            grid.innerHTML = '';
            items.forEach((item, idx) => {
                const card = document.createElement('div');
                card.className = 'history-card';

                /* Parse timestamp robustly */
                let tsStr = '—';
                try {
                    const raw = (item.timestamp || '').replace(' ', 'T');
                    const dt  = new Date(raw.includes('Z') ? raw : raw + 'Z');
                    tsStr = isNaN(dt.getTime()) ? item.timestamp : dt.toLocaleString();
                } catch(e) { tsStr = item.timestamp || '—'; }

                /* Category guess from query_image filename */
                const fname = item.query_image || 'Unknown image';
                const scoreBarW = Math.min(100, (item.result_count / 10) * 100);

                card.innerHTML = `
                    <div class="history-card-top">
                        <div class="history-icon"><i data-lucide="image"></i></div>
                        <div class="history-info">
                            <div class="history-filename" title="${fname}">${fname}</div>
                            <div class="history-date">${tsStr}</div>
                        </div>
                        <button class="history-delete-btn" data-id="${item.id}" title="Delete">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                    <div class="history-metrics">
                        <div class="hmetric">
                            <span class="hmetric-val accent">${item.result_count}</span>
                            <span class="hmetric-label">Results</span>
                        </div>
                        <div class="hmetric">
                            <span class="hmetric-val">${(item.processing_time || 0).toFixed(2)}s</span>
                            <span class="hmetric-label">Time</span>
                        </div>
                        <div class="hmetric">
                            <span class="hmetric-val">#${idx + 1}</span>
                            <span class="hmetric-label">Entry</span>
                        </div>
                    </div>
                    <div class="history-result-bar">
                        <div class="history-result-fill" style="width:${scoreBarW}%"></div>
                    </div>`;

                grid.appendChild(card);
            });

            lucide.createIcons();
            gsap.fromTo('.history-card',
                { y: 24, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.45, stagger: 0.07, ease: 'power2.out' }
            );

            grid.querySelectorAll('.history-delete-btn').forEach(btn => {
                btn.addEventListener('click', async e => {
                    e.stopPropagation();
                    const id   = btn.dataset.id;
                    const card = btn.closest('.history-card');
                    try {
                        const r = await fetch(`/api/history/${id}`, { method: 'DELETE' });
                        if (r.ok) {
                            gsap.to(card, { opacity: 0, height: 0, marginBottom: 0, padding: 0, duration: 0.35,
                                onComplete: () => {
                                    card.remove();
                                    if (!grid.querySelector('.history-card')) loadHistory();
                                }
                            });
                        }
                    } catch (err) {}
                });
            });

        } catch (e) {
            grid.innerHTML = '<div class="history-empty"><i data-lucide="wifi-off"></i><p>Failed to load history.</p></div>';
            lucide.createIcons();
        }
    }

    /* ── Analytics Dashboard ───────────────────────────── */
    async function initAnalytics() {
        /* Fetch embeddings data */
        const hint = document.getElementById('analytics-hint');

        let embData = null;
        try {
            const res = await fetch('/api/embeddings');
            if (res.ok) embData = await res.json();
        } catch (e) {}

        const hasData = embData && embData.points && embData.points.length > 1;

        if (hint) {
            hint.style.display = hasData ? 'none' : 'block';
        }

        /* 2D Scatter Plot */
        drawScatterPlot(embData);

        /* Session Stats */
        renderSessionStats();

        /* Category chart from last results */
        renderCategoryChart(lastResults);

        /* Similarity histogram */
        renderSimHistogram(lastResults);

        /* Color palette from last query */
        renderAnalyticsPalette(lastDominantColors);
    }

    /* ── 2D Canvas Scatter Plot ─────────────────────────── */
    function drawScatterPlot(data) {
        const canvas  = document.getElementById('scatter-canvas');
        const empty   = document.getElementById('scatter-empty');
        const tooltip = document.getElementById('scatter-tooltip');
        const wrap    = document.getElementById('scatter-wrap');

        if (!data || !data.points || data.points.length < 2) {
            if (canvas)  canvas.style.display = 'none';
            if (tooltip) tooltip.style.display = 'none';
            if (empty)   empty.style.display   = 'flex';
            return;
        }

        empty.style.display  = 'none';
        canvas.style.display = 'block';

        const W = wrap.clientWidth  || 600;
        const H = wrap.clientHeight || 380;
        canvas.width  = W;
        canvas.height = H;

        const ctx    = canvas.getContext('2d');
        const points = data.points;
        const scores = data.scores || [];

        /* Use PCA x (index 0) and y (index 1) */
        const xs = points.map(p => p[0]);
        const ys = points.map(p => p[1]);
        const xMin = Math.min(...xs), xMax = Math.max(...xs);
        const yMin = Math.min(...ys), yMax = Math.max(...ys);
        const PAD  = 40;

        function toCanvas(px, py) {
            return {
                cx: PAD + ((px - xMin) / (xMax - xMin || 1)) * (W - 2 * PAD),
                cy: H - PAD - ((py - yMin) / (yMax - yMin || 1)) * (H - 2 * PAD)
            };
        }

        /* Draw grid lines */
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth   = 1;
        for (let i = 1; i < 4; i++) {
            const gx = PAD + (i / 4) * (W - 2 * PAD);
            const gy = PAD + (i / 4) * (H - 2 * PAD);
            ctx.beginPath(); ctx.moveTo(gx, PAD); ctx.lineTo(gx, H - PAD); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(PAD, gy); ctx.lineTo(W - PAD, gy); ctx.stroke();
        }

        /* Draw connection lines from query to results */
        const q = toCanvas(xs[0], ys[0]);
        for (let i = 1; i < points.length; i++) {
            const s  = scores[i] || 0;
            const pt = toCanvas(xs[i], ys[i]);
            ctx.beginPath();
            ctx.moveTo(q.cx, q.cy);
            ctx.lineTo(pt.cx, pt.cy);
            ctx.strokeStyle = `rgba(59,130,246,${0.05 + s * 0.15})`;
            ctx.lineWidth   = 0.8;
            ctx.stroke();
        }

        /* Store node data for hover */
        const nodes = [];

        /* Draw result nodes */
        for (let i = 1; i < points.length; i++) {
            const s   = scores[i] || 0;
            const pt  = toCanvas(xs[i], ys[i]);
            const r   = 5 + s * 4;
            let color;
            if (s > 0.7)      color = '#10b981';
            else if (s > 0.4) color = '#3b82f6';
            else              color = '#f59e0b';

            ctx.beginPath();
            ctx.arc(pt.cx, pt.cy, r, 0, Math.PI * 2);
            ctx.fillStyle   = color + 'cc';
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth   = 1.5;
            ctx.stroke();

            nodes.push({ cx: pt.cx, cy: pt.cy, r, score: s,
                         imgPath: (data.image_paths || [])[i] || '', isQuery: false });
        }

        /* Draw query node on top */
        ctx.beginPath();
        ctx.arc(q.cx, q.cy, 11, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        /* Glow ring */
        const grd = ctx.createRadialGradient(q.cx, q.cy, 8, q.cx, q.cy, 22);
        grd.addColorStop(0, 'rgba(59,130,246,0.4)');
        grd.addColorStop(1, 'rgba(59,130,246,0)');
        ctx.beginPath();
        ctx.arc(q.cx, q.cy, 22, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        nodes.unshift({ cx: q.cx, cy: q.cy, r: 11, score: 1, imgPath: '', isQuery: true });

        /* Hover interaction */
        canvas.onmousemove = e => {
            const rect = canvas.getBoundingClientRect();
            const mx   = e.clientX - rect.left;
            const my   = e.clientY - rect.top;
            let hit = null;
            for (const nd of nodes) {
                if (Math.sqrt((mx - nd.cx)**2 + (my - nd.cy)**2) <= nd.r + 5) { hit = nd; break; }
            }
            if (hit) {
                canvas.style.cursor = 'pointer';
                const fname = hit.imagePath ? hit.imagePath.split('/').pop() : '';
                tooltip.innerHTML  = hit.isQuery
                    ? '<strong>Query Image</strong>'
                    : `<strong>${(hit.score*100).toFixed(1)}% match</strong>${fname ? '<br><span>'+fname+'</span>' : ''}`;
                tooltip.style.left    = (mx + 14) + 'px';
                tooltip.style.top     = (my - 10) + 'px';
                tooltip.style.display = 'block';
            } else {
                canvas.style.cursor   = 'default';
                tooltip.style.display = 'none';
            }
        };
        canvas.onmouseleave = () => { tooltip.style.display = 'none'; };
    }

    /* ── Session Statistics ─────────────────────────────── */
    async function renderSessionStats() {
        try {
            const res  = await fetch('/api/stats');
            if (!res.ok) return;
            const data = await res.json();
            const el   = id => document.getElementById(id);
            if (el('stat-total'))   el('stat-total').textContent   = data.total_searches ?? '—';
            if (el('stat-avgtime')) el('stat-avgtime').textContent = data.avg_time ? data.avg_time + 's' : '—';
            if (el('stat-topscore')) el('stat-topscore').textContent = lastResults.length
                ? (lastResults[0].similarity_score * 100).toFixed(1) + '%' : '—';
            if (el('stat-results')) el('stat-results').textContent = lastResults.length || '—';
        } catch (e) {}
    }

    /* ── Category Chart ─────────────────────────────────── */
    function renderCategoryChart(results) {
        const container = document.getElementById('category-chart');
        const badge     = document.getElementById('cat-total-badge');
        if (!container) return;

        if (!results || results.length === 0) {
            container.innerHTML = '<p class="cat-empty">Run a search to see category breakdown</p>';
            if (badge) badge.textContent = '';
            return;
        }

        const counts = {};
        results.forEach(r => {
            const cat = (r.image_path || '').split('/')[0] || 'Unknown';
            counts[cat] = (counts[cat] || 0) + 1;
        });

        const sorted  = Object.entries(counts).sort((a,b) => b[1] - a[1]);
        const maxCount = sorted[0][1];
        if (badge) badge.textContent = `${sorted.length} categories`;

        const COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#84cc16'];

        container.innerHTML = '';
        sorted.forEach(([cat, cnt], i) => {
            const pct = Math.round((cnt / maxCount) * 100);
            const row = document.createElement('div');
            row.className = 'cat-row';
            row.innerHTML = `
                <div class="cat-label">${cat}</div>
                <div class="cat-bar-wrap">
                    <div class="cat-bar-fill" style="width:0%;background:${COLORS[i % COLORS.length]}" data-width="${pct}%"></div>
                </div>
                <div class="cat-count">${cnt}</div>`;
            container.appendChild(row);
        });

        /* Animate bars */
        requestAnimationFrame(() => {
            container.querySelectorAll('.cat-bar-fill').forEach(bar => {
                bar.style.width = bar.dataset.width;
            });
        });
    }

    /* ── Similarity Histogram ───────────────────────────── */
    function renderSimHistogram(results) {
        const container = document.getElementById('sim-histogram');
        const badge     = document.getElementById('sim-panel-badge');
        if (!container) return;

        if (!results || results.length === 0) {
            container.innerHTML = '<p class="cat-empty">Run a search to see score distribution</p>';
            if (badge) badge.textContent = '';
            return;
        }

        /* Bucket scores into 5 bands */
        const bands = [
            { label: '80–100%', min: 0.8, max: 1.01, color: '#10b981' },
            { label: '60–80%',  min: 0.6, max: 0.8,  color: '#3b82f6' },
            { label: '40–60%',  min: 0.4, max: 0.6,  color: '#8b5cf6' },
            { label: '20–40%',  min: 0.2, max: 0.4,  color: '#f59e0b' },
            { label: '0–20%',   min: 0,   max: 0.2,  color: '#ef4444' }
        ];

        bands.forEach(b => { b.count = results.filter(r => r.similarity_score >= b.min && r.similarity_score < b.max).length; });
        const maxCnt = Math.max(...bands.map(b => b.count), 1);
        if (badge) badge.textContent = `${results.length} matches`;

        container.innerHTML = '';
        bands.forEach(b => {
            const pct = Math.round((b.count / maxCnt) * 100);
            const row = document.createElement('div');
            row.className = 'cat-row';
            row.innerHTML = `
                <div class="cat-label">${b.label}</div>
                <div class="cat-bar-wrap">
                    <div class="cat-bar-fill" style="width:0%;background:${b.color}" data-width="${pct}%"></div>
                </div>
                <div class="cat-count">${b.count}</div>`;
            container.appendChild(row);
        });

        requestAnimationFrame(() => {
            container.querySelectorAll('.cat-bar-fill').forEach(bar => {
                bar.style.width = bar.dataset.width;
            });
        });
    }

    /* ── Analytics Palette ──────────────────────────────── */
    function renderAnalyticsPalette(colors) {
        const el = document.getElementById('analytics-palette');
        if (!el) return;

        if (!colors || colors.length === 0) {
            el.innerHTML = '<p class="palette-empty">Upload an image to extract color palette</p>';
            return;
        }

        el.innerHTML = '';
        colors.forEach(([r,g,b]) => {
            const hex    = colorToHex(r,g,b);
            const lum    = 0.299*r + 0.587*g + 0.114*b;
            const txtCol = lum < 128 ? '#ffffff' : '#000000';
            const chip   = document.createElement('div');
            chip.className   = 'aplt-chip';
            chip.style.background = hex;
            chip.style.color      = txtCol;
            chip.innerHTML   = `<span>${hex}</span>`;
            chip.title       = hex;
            chip.addEventListener('click', () => {
                navigator.clipboard?.writeText(hex).catch(()=>{});
                chip.classList.add('copied');
                setTimeout(() => chip.classList.remove('copied'), 1000);
            });
            el.appendChild(chip);
        });
    }

    /* ── Window resize ──────────────────────────────────── */
    window.addEventListener('resize', () => {
        if (lastDetections.length > 0 && queryPreview.complete) {
            drawBoundingBoxes(lastDetections, activeClassFilter);
        }
    });

    /* helper */
    function id(s) { return document.getElementById(s); }

});
