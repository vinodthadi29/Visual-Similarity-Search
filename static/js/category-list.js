/**
 * CategoryList - A Vanilla JS port of the React CategoryList component
 * Handles hover expansion, corner brackets, and icon reveals.
 */
class CategoryList {
    constructor(containerId, options) {
        this.container = document.getElementById(containerId);
        this.options = options;
        this.init();
    }

    init() {
        this.render();
        this.setupEventListeners();
        this.animateIn();
    }

    animateIn() {
        gsap.from(this.container.querySelectorAll('.category-item-group'), {
            opacity: 0,
            y: 30,
            stagger: 0.15,
            duration: 0.8,
            ease: "back.out(1.7)"
        });
    }

    render() {
        const { title, subtitle, categories, headerIcon } = this.options;

        this.container.innerHTML = `
            <div class="category-list-wrapper w-full bg-background text-foreground p-8">
                <div class="max-w-4xl mx-auto">
                    <!-- Header Section -->
                    <div class="text-center mb-12 md:mb-16 header-section">
                        ${headerIcon ? `
                            <div class="header-icon-wrapper inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/80 to-primary mb-6 text-white shadow-2xl">
                                ${headerIcon}
                            </div>
                        ` : ''}
                        <h1 class="text-4xl md:text-5xl font-bold mb-2 tracking-tight text-white headline-anim">${title}</h1>
                        ${subtitle ? `<h2 class="text-4xl md:text-5xl font-bold text-gray-500 opacity-60 subtitle-anim">${subtitle}</h2>` : ''}
                    </div>

                    <!-- Categories List -->
                    <div class="space-y-4 category-items-container">
                        ${categories.map(cat => this.renderCategoryItem(cat)).join('')}
                    </div>
                </div>
            </div>
        `;

        // Animate headers separately
        gsap.from('.header-icon-wrapper', { scale: 0, rotation: -45, duration: 1, ease: "elastic.out(1, 0.5)" });
        gsap.from('.headline-anim', { y: 20, opacity: 0, delay: 0.2 });
        gsap.from('.subtitle-anim', { y: 20, opacity: 0, delay: 0.4 });
    }

    renderCategoryItem(category) {
        return `
            <div class="category-item-group relative group" data-id="${category.id}">
                <div class="category-item-card relative overflow-hidden border border-white/5 bg-[#0d0d0d] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] cursor-pointer h-24 flex items-center px-6 md:px-10 rounded-xl hover:bg-blue-500/5">
                    <!-- Brackets -->
                    <div class="brackets absolute inset-0 pointer-events-none opacity-0 transition-all duration-500 scale-95">
                        <div class="absolute top-4 left-4 w-6 h-6">
                            <div class="absolute top-0 left-0 w-5 h-0.5 bg-blue-500 shadow-[0_0_10px_#3b82f6]"></div>
                            <div class="absolute top-0 left-0 w-0.5 h-5 bg-blue-500 shadow-[0_0_10px_#3b82f6]"></div>
                        </div>
                        <div class="absolute bottom-4 right-4 w-6 h-6">
                            <div class="absolute bottom-0 right-0 w-5 h-0.5 bg-blue-500 shadow-[0_0_10px_#3b82f6]"></div>
                            <div class="absolute bottom-0 right-0 w-0.5 h-5 bg-blue-500 shadow-[0_0_10px_#3b82f6]"></div>
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="flex items-center justify-between w-full h-full relative z-10">
                        <div class="flex-1">
                            <h3 class="category-title font-bold transition-all duration-300 ${category.featured ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'} text-white/90 group-hover:text-blue-400 group-hover:translate-x-2">
                                ${category.title}
                            </h3>
                            ${category.subtitle ? `
                                <p class="category-subtitle mt-1 transition-all duration-300 text-sm md:text-base text-gray-500 group-hover:text-gray-300 group-hover:translate-x-2">
                                    ${category.subtitle}
                                </p>
                            ` : ''}
                        </div>

                        <!-- Icon (Revealed on hover) -->
                        ${category.icon ? `
                            <div class="category-icon text-blue-500 opacity-0 group-hover:opacity-100 transition-all duration-500 -translate-x-4 group-hover:translate-x-0">
                                ${category.icon}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        const items = this.container.querySelectorAll('.category-item-group');
        items.forEach(item => {
            const card = item.querySelector('.category-item-card');
            const brackets = item.querySelector('.brackets');
            const icon = item.querySelector('.category-icon');

            item.addEventListener('mouseenter', () => {
                gsap.to(card, {
                    height: 140,
                    borderColor: 'rgba(59, 130, 246, 0.4)',
                    duration: 0.5,
                    ease: "power3.out"
                });
                gsap.to(brackets, { opacity: 1, scale: 1, duration: 0.4 });
                if (icon) gsap.to(icon, { rotation: 360, duration: 0.6 });
            });

            item.addEventListener('mouseleave', () => {
                gsap.to(card, {
                    height: 96,
                    borderColor: 'rgba(255, 255, 255, 0.05)',
                    duration: 0.4,
                    ease: "power2.inOut"
                });
                gsap.to(brackets, { opacity: 0, scale: 0.95, duration: 0.3 });
                if (icon) gsap.to(icon, { rotation: 0, duration: 0.5 });
            });

            item.addEventListener('click', () => {
                const id = item.getAttribute('data-id');
                const category = this.options.categories.find(c => c.id == id);
                if (category && category.onClick) category.onClick();
            });
        });
    }
}

// Global initialization for About page
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('category-list-container');
    if (container) {
        const categories = [
            {
                id: 1,
                title: 'Region of Interest (YOLOv8)',
                subtitle: 'Before global feature extraction, the system utilizes Ultralytics YOLOv8 for precise object detection. This isolates specific entities within complex scenes, allowing users to crop and query distinct objects rather than the entire noisy image.',
                featured: true,
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-focus"><circle cx="12" cy="12" r="3"/><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>'
            },
            {
                id: 2,
                title: 'Feature Extraction (MobileNetV2)',
                subtitle: 'The isolated image is passed through a pre-trained MobileNetV2 Convolutional Neural Network. The final classification head is bypassed to yield a dense, 1280-dimensional embedding—a mathematical fingerprint of the visual textures and shapes.',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cpu"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>'
            },
            {
                id: 3,
                title: 'Vector Retrieval (FAISS)',
                subtitle: 'Embeddings are L2-normalized and indexed using Meta\'s FAISS (Facebook AI Similarity Search). The system executes an exact Inner Product search, mathematically equivalent to Cosine Similarity, to retrieve the nearest neighbors in milliseconds.',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-database"><crosshair cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M2 12h20"/><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/></svg>'
            },
            {
                id: 4,
                title: 'Explainability (Grad-CAM)',
                subtitle: 'To ensure transparency, Gradient-weighted Class Activation Mapping (Grad-CAM) is applied. By intercepting the gradients of the final convolutional layer, the system generates thermal heatmaps proving exactly which pixels influenced the similarity match.',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>'
            }
        ];

        new CategoryList('category-list-container', {
            title: "Architecture",
            subtitle: "Core Modules",
            categories: categories,
            headerIcon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-layout-grid"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>'
        });
    }
});
