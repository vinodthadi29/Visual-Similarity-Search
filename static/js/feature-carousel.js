/**
 * FeatureCarousel - A GSAP-powered terminal transition logic
 * Ported from React component FeatureCarousel
 */
class FeatureCarousel {
    constructor(containerId, steps) {
        this.container = document.getElementById(containerId);
        this.steps = steps;
        this.currentStep = 0;
        this.interval = 5000;
        this.timer = null;
        this.isAnimating = false;

        this.init();
    }

    init() {
        this.renderStructure();
        this.startTimer();
        this.setupEventListeners();
        this.updateUI();
    }

    renderStructure() {
        this.container.innerHTML = `
            <div class="carousel-nav">
                <ul class="step-list"></ul>
            </div>
            <div class="carousel-content h-full relative">
                <div class="carousel-info">
                   <h2 class="carousel-title"></h2>
                   <p class="carousel-desc"></p>
                </div>
                <div class="carousel-visual h-full relative"></div>
            </div>
            <div class="carousel-overlay"></div>
        `;

        const list = this.container.querySelector('.step-list');
        this.steps.forEach((step, idx) => {
            const li = document.createElement('li');
            li.className = `step-item ${idx === 0 ? 'active' : ''}`;
            li.innerHTML = `
                <span class="step-num">${idx + 1}</span>
                <span class="step-name">${step.name}</span>
            `;
            li.addEventListener('click', (e) => {
                e.stopPropagation();
                this.goToStep(idx);
            });
            list.appendChild(li);
        });
    }

    setupEventListeners() {
        this.container.addEventListener('click', () => this.nextStep());
    }

    startTimer() {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => this.nextStep(), this.interval);
    }

    nextStep() {
        if (this.isAnimating) return;
        this.goToStep((this.currentStep + 1) % this.steps.length);
    }

    goToStep(index) {
        if (index === this.currentStep || this.isAnimating) return;
        this.isAnimating = true;
        this.currentStep = index;
        this.startTimer();
        this.updateUI();
    }

    updateUI() {
        const step = this.steps[this.currentStep];
        const titleEl = this.container.querySelector('.carousel-title');
        const descEl = this.container.querySelector('.carousel-desc');
        const visualEl = this.container.querySelector('.carousel-visual');
        const items = this.container.querySelectorAll('.step-item');

        // Update nav
        items.forEach((item, idx) => {
            item.classList.toggle('active', idx === this.currentStep);
            item.classList.toggle('completed', idx < this.currentStep);
        });

        // Animate content
        gsap.to([titleEl, descEl], {
            opacity: 0, y: -20, duration: 0.3, onComplete: () => {
                titleEl.textContent = step.title;
                descEl.textContent = step.description;
                gsap.fromTo([titleEl, descEl], { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 });
            }
        });

        // Animate Visuals
        gsap.to(visualEl.children, {
            opacity: 0, scale: 0.9, duration: 0.4, onComplete: () => {
                visualEl.innerHTML = '';

                step.images.forEach((imgSrc, i) => {
                    const img = document.createElement('img');
                    img.src = imgSrc;
                    img.className = `carousel-img img-${i}`;
                    visualEl.appendChild(img);

                    const preset = i === 0 ? { x: -30, opacity: 0, scale: 0.9 } : { x: 30, opacity: 0, scale: 0.9 };
                    gsap.fromTo(img, preset, {
                        x: 0, opacity: 1, scale: 1,
                        duration: 0.6, delay: i * 0.1,
                        ease: "power2.out",
                        onComplete: () => { this.isAnimating = false; }
                    });
                });
            }
        });
    }
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('feature-carousel-container')) {
        const steps = [
            {
                name: "Step 1",
                title: "Region of Interest (YOLOv8)",
                description: "Ultralytics YOLOv8 isolates specific entities, allowing for specialized object-level neural queries.",
                images: ["https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800", "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=800"]
            },
            {
                name: "Step 2",
                title: "Feature Extraction",
                description: "MobileNetV2 yields a dense embedding—a mathematical fingerprint of visual textures.",
                images: ["https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800", "https://images.unsplash.com/photo-1620712943543-bcc4628c9757?auto=format&fit=crop&q=80&w=800"]
            },
            {
                name: "Step 3",
                title: "Vector Retrieval (FAISS)",
                description: "Meta's FAISS executes an exact Inner Product search to retrieve neighbors in milliseconds.",
                images: ["https://images.unsplash.com/photo-1558494949-ef010cbdcc48?auto=format&fit=crop&q=80&w=800"]
            },
            {
                name: "Step 4",
                title: "Explainability (Grad-CAM)",
                description: "Gradient-weighted Class Activation Mapping proves which pixels influenced the similarity match.",
                images: ["https://images.unsplash.com/photo-1509228468518-180dd48219d1?auto=format&fit=crop&q=80&w=800"]
            }
        ];
        new FeatureCarousel('feature-carousel-container', steps);
    }
});
