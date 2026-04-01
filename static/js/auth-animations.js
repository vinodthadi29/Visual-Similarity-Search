/**
 * GSAP implementation of the WarningGraphic animation sequence
 * Mimics the Framer Motion behavior from warning-graphic.tsx
 */

function animateWarningGraphic(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Reset visibility and state
    const paths = container.querySelectorAll('.warning-path-line');
    const triangle = container.querySelector('.warning-triangle');
    const stripes = container.querySelectorAll('.warning-stripe');
    const exclamation = container.querySelector('.warning-exclamation');
    const rects = container.querySelectorAll('.warning-rect');

    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

    // Initial clear
    gsap.set([triangle, stripes, exclamation, rects], { opacity: 0 });
    gsap.set(paths, { strokeDasharray: 200, strokeDashoffset: 200 });

    // 1. Path lines draw from inside out
    tl.to(paths, {
        strokeDashoffset: 0,
        duration: 1.2,
        stagger: 0.1,
        ease: "power1.inOut"
    });

    // 2. Triangle outline draws
    tl.to(triangle, {
        opacity: 1,
        duration: 0.8,
        onStart: () => {
            // Basic SVG path drawing simulation if not a complex path
            gsap.fromTo(triangle, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.8 });
        }
    }, 0.6);

    // 3. Interior stripes animate from center
    tl.to(stripes, {
        opacity: 1,
        scaleX: 1,
        duration: 0.5,
        stagger: 0.08,
        ease: "back.out(1.7)"
    }, 1.4);

    // 4. Exclamation with overshoot
    tl.fromTo(exclamation,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.6, ease: "elastic.out(1, 0.5)" },
        2.0
    );

    // 5. Corner rectangles fade in last
    tl.to(rects, {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.4,
        stagger: 0.1,
        ease: "power2.out"
    }, 2.5);

    return tl;
}
