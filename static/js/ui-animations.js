document.addEventListener('DOMContentLoaded', () => {
    initAnimeNav();
    initShufflingCards();
});

/**
 * --- Anime Navbar Animation ---
 */
function initAnimeNav() {
    const navLinks = document.querySelectorAll('.anime-nav-link');
    const nav = document.querySelector('.anime-nav');
    if (!nav) return;

    // Create Active Glow
    const glow = document.createElement('div');
    glow.className = 'active-glow';
    nav.appendChild(glow);

    // Create Mascot
    const mascotContainer = document.createElement('div');
    mascotContainer.className = 'mascot-container';
    mascotContainer.innerHTML = `
        <div class="mascot">
            <div class="mascot-ear left"></div>
            <div class="mascot-ear right"></div>
            <div class="mascot-eye left"></div>
            <div class="mascot-eye right"></div>
            <div class="mascot-blush left"></div>
            <div class="mascot-blush right"></div>
            <div class="mascot-mouth"></div>
            <div class="mascot-base"></div>
            <div class="sparkle" style="top: -10px; right: -5px;">✨</div>
            <div class="sparkle" style="top: -20px; left: -10px;">✨</div>
        </div>
    `;
    nav.appendChild(mascotContainer);

    const mascot = mascotContainer.querySelector('.mascot');
    const eyes = mascotContainer.querySelectorAll('.mascot-eye');
    const mouth = mascotContainer.querySelector('.mascot-mouth');
    const sparkles = mascotContainer.querySelectorAll('.sparkle');
    const mascotBase = mascotContainer.querySelector('.mascot-base');

    // Add shine element to glow
    const shine = document.createElement('div');
    shine.className = 'nav-shine';
    glow.appendChild(shine);

    function updateActiveState(link, isHover = false) {
        const rect = link.getBoundingClientRect();
        const navRect = nav.getBoundingClientRect();

        const left = rect.left - navRect.left;
        const width = rect.width;

        glow.style.left = `${left}px`;
        glow.style.width = `${width}px`;
        glow.style.height = `${rect.height}px`;
        glow.style.top = `${rect.top - navRect.top}px`;

        mascotContainer.style.left = `${left + width / 2 - 25}px`;
        mascotContainer.style.display = 'block';

        if (isHover) {
            // Mascot Hopping animation
            gsap.to(mascot, { scale: 1.1, rotate: 5, duration: 0.2, yoyo: true, repeat: 1 });
            gsap.to(eyes, { scaleY: 0.2, duration: 0.1, yoyo: true, repeat: 1 });
            gsap.to(mouth, { scaleY: 1.5, y: -1, duration: 0.2 });
            sparkles.forEach(s => s.classList.add('active'));
            gsap.to(mascotBase, { y: -4, duration: 0.15, yoyo: true, repeat: 1 });
        } else {
            gsap.to(mouth, { scaleY: 1, y: 0, duration: 0.2 });
            sparkles.forEach(s => s.classList.remove('active'));
        }
    }

    // Initial state
    const activeLink = document.querySelector('.anime-nav-link.active') || navLinks[0];
    if (activeLink) {
        setTimeout(() => updateActiveState(activeLink), 100);
    }

    navLinks.forEach(link => {
        link.addEventListener('mouseenter', () => {
            updateActiveState(link, true);
        });
    });

    nav.addEventListener('mouseleave', () => {
        const currentActive = document.querySelector('.anime-nav-link.active');
        if (currentActive) updateActiveState(currentActive, false);
    });
}

/**
 * --- Shuffling Cards Animation ---
 */
function initShufflingCards() {
    const container = document.querySelector('.shuffle-container');
    if (!container) return;

    const cards = Array.from(document.querySelectorAll('.shuffling-card'));
    let positions = cards.map((_, i) => i); // 0, 1, 2, 3...

    function updateCardPositions() {
        cards.forEach((card, index) => {
            const pos = positions[index];
            const isFront = pos === 0;
            const isMiddle = pos === 1;
            const isBack = pos === 2;
            const isExtra = pos >= 3;

            let x = "0%";
            let rotate = "0deg";
            let zIndex = 0;
            let scale = 1;
            let opacity = 1;

            if (isFront) {
                x = "0%";
                rotate = "-6deg";
                zIndex = 10;
            } else if (isMiddle) {
                x = "30%";
                rotate = "0deg";
                zIndex = 5;
                scale = 0.95;
            } else if (isBack) {
                x = "60%";
                rotate = "6deg";
                zIndex = 2;
                scale = 0.9;
            } else {
                x = "90%";
                rotate = "12deg";
                zIndex = 1;
                scale = 0.85;
                opacity = 0; // Hide extra cards
            }

            gsap.to(card, {
                x: x,
                rotate: rotate,
                zIndex: zIndex,
                scale: scale,
                opacity: opacity,
                duration: 0.5,
                ease: "back.out(1.2)"
            });

            // Enable drag only for front card
            if (isFront && typeof Draggable !== 'undefined') {
                Draggable.create(card, {
                    type: "x",
                    onDragEnd: function () {
                        if (this.x < -150) {
                            shuffle();
                        } else {
                            gsap.to(this.target, { x: 0, duration: 0.3 });
                        }
                    }
                });
            } else if (Draggable.get(card)) {
                Draggable.get(card).disable();
            }
        });
    }

    function shuffle() {
        // Shift positions: [0, 1, 2, 3] -> [3, 0, 1, 2]
        const last = positions.pop();
        positions.unshift(last);
        updateCardPositions();
    }

    // Initial render
    updateCardPositions();

}

/**
 * --- File Upload Hover Animation ---
 */
function initUploadHover() {
    const dropArea = document.getElementById('drop-area');
    const visualBox = document.querySelector('.upload-visual-box');
    const ghostBox = document.querySelector('.upload-ghost-box');

    if (!dropArea || !visualBox || !ghostBox) return;

    dropArea.addEventListener('mouseenter', () => {
        gsap.to(visualBox, {
            x: 20,
            y: -20,
            opacity: 0.9,
            duration: 0.4,
            ease: "power2.out"
        });
        gsap.to(ghostBox, {
            opacity: 1,
            duration: 0.4,
            ease: "power2.out"
        });
    });

    dropArea.addEventListener('mouseleave', () => {
        gsap.to(visualBox, {
            x: 0,
            y: 0,
            opacity: 1,
            duration: 0.4,
            ease: "power2.inOut"
        });
        gsap.to(ghostBox, {
            opacity: 0,
            duration: 0.4,
            ease: "power2.inOut"
        });
    });
}
