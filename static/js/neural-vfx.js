class NeuralNexusVFX {
    constructor(containerId) {
        this.container = document.createElement('div');
        this.container.id = 'neural-nexus-container';
        this.container.style.position = 'absolute';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.zIndex = '0'; // Behind UI but above gradient background
        document.getElementById(containerId).appendChild(this.container);

        this.init();
        this.animate();
        this.bindEvents();
    }

    init() {
        // Scene Setup
        this.scene = new THREE.Scene();

        // Camera Setup
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
        this.camera.position.z = 250;

        // Renderer Setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        this.container.appendChild(this.renderer.domElement);

        // Core Group for rotation
        this.coreGroup = new THREE.Group();
        this.scene.add(this.coreGroup);

        // Post-Processing
        this.renderScene = new THREE.RenderPass(this.scene, this.camera);

        // UnrealBloomPass parameters: resolution, strength, radius, threshold
        this.bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5, // Bloom Strength
            0.4, // Bloom Radius
            0.1  // Bloom Threshold
        );

        this.composer = new THREE.EffectComposer(this.renderer);
        this.composer.addPass(this.renderScene);
        this.composer.addPass(this.bloomPass);

        this.createParticles();
        this.createConnections();

        // Interaction variables
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetRotationX = 0;
        this.targetRotationY = 0;

        this.time = 0;
    }

    createParticles() {
        const particleCount = 4000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        const color1 = new THREE.Color(0x3b82f6); // Primary blue
        const color2 = new THREE.Color(0x8b5cf6); // Secondary purple
        const color3 = new THREE.Color(0x0ea5e9); // Cyan highlight

        for (let i = 0; i < particleCount; i++) {
            // Spherical distribution
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            // Core dense shell, sparse outer shell
            let r = 80 + (Math.random() ** 3) * 60;

            if (Math.random() > 0.9) {
                r = 150 + Math.random() * 50; // rogue outer elements
            }

            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);

            // Assign colors based on radius to create depth
            let targetColor = color1;
            const randColor = Math.random();
            if (randColor > 0.6) targetColor = color2;
            if (randColor > 0.9) targetColor = color3;
            if (r > 120) targetColor = new THREE.Color(0x1e293b); // Dim outer

            colors[i * 3] = targetColor.r;
            colors[i * 3 + 1] = targetColor.g;
            colors[i * 3 + 2] = targetColor.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Create glowing material
        const material = new THREE.PointsMaterial({
            size: 1.5,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            opacity: 0.8
        });

        this.particles = new THREE.Points(geometry, material);
        this.coreGroup.add(this.particles);
    }

    createConnections() {
        this.splineMeshes = [];
        this.packets = [];

        const splineCount = 40;
        const colorCyan = new THREE.Color(0x00f8ff);

        for (let i = 0; i < splineCount; i++) {
            // Create random spline anchor points
            const points = [];
            let currentPoint = new THREE.Vector3(
                (Math.random() - 0.5) * 100,
                (Math.random() - 0.5) * 100,
                (Math.random() - 0.5) * 100
            );

            points.push(currentPoint);

            for (let j = 0; j < 3; j++) {
                currentPoint = currentPoint.clone().add(
                    new THREE.Vector3(
                        (Math.random() - 0.5) * 80,
                        (Math.random() - 0.5) * 80,
                        (Math.random() - 0.5) * 80
                    )
                );
                points.push(currentPoint);
            }

            const curve = new THREE.CatmullRomCurve3(points);
            const geometry = new THREE.TubeGeometry(curve, 20, 0.4, 8, false);

            const material = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0x3b82f6 : 0x8b5cf6, // random blue or purple
                transparent: true,
                opacity: 0.1,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });

            const splineMesh = new THREE.Mesh(geometry, material);
            this.coreGroup.add(splineMesh);
            this.splineMeshes.push(splineMesh);

            // Create Data Packets traveling along splines
            const packetGeo = new THREE.SphereGeometry(1.5, 8, 8);
            const packetMat = new THREE.MeshBasicMaterial({
                color: colorCyan,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending
            });

            const packet = new THREE.Mesh(packetGeo, packetMat);
            this.coreGroup.add(packet);

            this.packets.push({
                mesh: packet,
                curve: curve,
                progress: Math.random(),
                speed: 0.002 + Math.random() * 0.003
            });
        }
    }

    bindEvents() {
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        document.addEventListener('mousemove', this.onMouseMove.bind(this), false);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    onMouseMove(event) {
        // Normalize mouse coordinates (-1 to +1)
        this.mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        this.time += 0.01;

        // Smoothly interpolate rotation based on mouse movement (Parallax)
        this.targetRotationX = this.mouseY * 0.2;
        this.targetRotationY = this.mouseX * 0.2;

        this.coreGroup.rotation.x += (this.targetRotationX - this.coreGroup.rotation.x) * 0.05;
        this.coreGroup.rotation.y += (this.targetRotationY - this.coreGroup.rotation.y) * 0.05;

        // Base Idle Rotation
        this.coreGroup.rotation.y += 0.001;
        this.coreGroup.rotation.z += 0.0005;

        // Animate Data Packets
        this.packets.forEach(packetObj => {
            packetObj.progress += packetObj.speed;
            if (packetObj.progress > 1) {
                packetObj.progress = 0; // Loop packet
            }

            const position = packetObj.curve.getPointAt(packetObj.progress);
            packetObj.mesh.position.copy(position);

            // Pulse the packet size
            const scale = 1 + Math.sin(packetObj.progress * Math.PI * 10) * 0.5;
            packetObj.mesh.scale.set(scale, scale, scale);
        });

        // Pulsating Particle Core (Sin wave on scale)
        const pulse = 1 + Math.sin(this.time) * 0.02;
        this.particles.scale.set(pulse, pulse, pulse);

        // Render via composer for Bloom Effect
        this.composer.render();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if the container exists
    if (document.getElementById('globe-canvas')) {
        window.neuralVFX = new NeuralNexusVFX('globe-canvas');
    }
});
