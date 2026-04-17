/**
 * AstraGuardian 3D Robot Assistant (Advanced Professional Version)
 * Ported from AstraVision Spatial AI Platform
 */

class AstraGuardian {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.state = 'idle';
        this.typingActivity = 0;
        this.keystrokePulse = 0;
        this.lastPulse = 0;
        this.inputLength = 0;

        // Animation State Values
        this.v = {
            headTiltX: 0, headTiltZ: 0, headY: 0, headSquash: 1,
            eyeScaleY: 1, pupilX: 0, pupilY: 0, eyeGlow: 1,
            browY: 0.35, browRot: 0,
            leftHandX: -1.1, leftHandY: -0.3, leftHandZ: 0.3,
            rightHandX: 1.1, rightHandY: -0.3, rightHandZ: 0.3,
            handScale: 1, bodyY: -1.2, bodyScale: 1,
            antennaWiggle: 0, antennaBallGlow: 1,
            mouthScale: 0.5, mouthY: -0.35,
            accentR: 0.545, accentG: 0.361, accentB: 0.965,
            bounce: 0, breathe: 0, keystrokeBump: 0,
            blinkTimer: 0, isBlinking: false,
            idleLookTarget: 0, idleLookTimer: 0,
            celebrationPhase: 0
        };

        this.webglFailed = false;
        this.initScene();
        if (this.webglFailed) return;

        this.initLighting();
        this.createCharacter();
        this.animate();

        window.addEventListener('resize', () => this.onWindowResize());
    }

    initScene() {
        const W = this.container.clientWidth;
        const H = this.container.clientHeight;

        /* Check WebGL availability before trying to create renderer */
        const testCanvas = document.createElement('canvas');
        const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
        if (!gl) {
            this.webglFailed = true;
            this._showCSSFallback();
            return;
        }

        try {
            this.scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
            this.camera.position.set(0, 0.2, 7);

            this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
            this.renderer.setSize(W, H);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.container.appendChild(this.renderer.domElement);
        } catch (e) {
            this.webglFailed = true;
            this._showCSSFallback();
        }
    }

    _showCSSFallback() {
        this.container.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:1rem;">
                <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);
                     animation:guardianPulse 2s ease-in-out infinite;box-shadow:0 0 30px rgba(59,130,246,0.4);"></div>
                <div style="font-size:0.75rem;color:rgba(255,255,255,0.35);letter-spacing:0.1em;text-transform:uppercase;">AstraGuardian</div>
            </div>
            <style>@keyframes guardianPulse{0%,100%{transform:scale(1);opacity:0.85}50%{transform:scale(1.12);opacity:1}}</style>`;
    }

    initLighting() {
        const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
        this.scene.add(ambientLight);

        // Key Light (Cyan)
        this.keyLight = new THREE.PointLight(0x00e5ff, 2.5, 20);
        this.keyLight.position.set(3, 4, 5);
        this.keyLight.castShadow = true;
        this.keyLight.shadow.mapSize.width = 1024;
        this.keyLight.shadow.mapSize.height = 1024;
        this.scene.add(this.keyLight);

        // Fill Light (Amber)
        const fillLight = new THREE.PointLight(0xff8a50, 1.5, 20);
        fillLight.position.set(-4, 1, 4);
        this.scene.add(fillLight);

        // Rim Light (Violet)
        const rimLight = new THREE.SpotLight(0xb388ff, 4);
        rimLight.position.set(0, 5, -5);
        this.scene.add(rimLight);

        // Bottom accent light (Teal)
        const bottomLight = new THREE.PointLight(0x00bfa5, 1, 10);
        bottomLight.position.set(0, -3, 3);
        this.scene.add(bottomLight);
    }

    createCharacter() {
        this.character = new THREE.Group();
        this.scene.add(this.character);

        // Materials
        this.metallicMat = new THREE.MeshPhongMaterial({
            color: 0x1a2a3a, emissive: 0x061218, emissiveIntensity: 0.3,
            specular: 0x66aacc, shininess: 80
        });

        this.accentMat = new THREE.MeshPhongMaterial({
            color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.6,
            specular: 0xffffff, shininess: 120
        });

        // HEAD
        const headGeo = new THREE.SphereGeometry(1, 64, 64);
        this.head = new THREE.Mesh(headGeo, this.metallicMat);
        this.head.castShadow = true;
        this.head.receiveShadow = true;
        this.character.add(this.head);

        // Visor
        const visorGeo = new THREE.SphereGeometry(0.9, 64, 64, 0, Math.PI * 2, 0, Math.PI * 0.35);
        const visorMat = new THREE.MeshPhongMaterial({ color: 0x0a1520, specular: 0x44ccff, shininess: 150 });
        this.visor = new THREE.Mesh(visorGeo, visorMat);
        this.visor.rotation.x = -Math.PI / 2;
        this.visor.position.z = 0.12;
        this.visor.scale.set(1, 1, 0.5);
        this.head.add(this.visor);

        // Eyes White
        const eyeWhiteGeo = new THREE.SphereGeometry(0.28, 32, 32);
        this.eyeWhiteMat = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0xeeffff, emissiveIntensity: 0.4, specular: 0xffffff, shininess: 120 });

        this.leftEyeWhite = new THREE.Mesh(eyeWhiteGeo, this.eyeWhiteMat);
        this.leftEyeWhite.position.set(-0.35, 0.15, 0.85);
        this.head.add(this.leftEyeWhite);

        this.rightEyeWhite = new THREE.Mesh(eyeWhiteGeo, this.eyeWhiteMat);
        this.rightEyeWhite.position.set(0.35, 0.15, 0.85);
        this.head.add(this.rightEyeWhite);

        // Irises
        const irisGeo = new THREE.TorusGeometry(0.16, 0.02, 16, 32);
        this.leftIris = new THREE.Mesh(irisGeo, this.accentMat.clone());
        this.leftIris.position.set(0, 0, 0.22);
        this.leftEyeWhite.add(this.leftIris);

        this.rightIris = new THREE.Mesh(irisGeo, this.accentMat.clone());
        this.rightIris.position.set(0, 0, 0.22);
        this.rightEyeWhite.add(this.rightIris);

        // Pupils
        const pupilGeo = new THREE.SphereGeometry(0.12, 32, 32);
        const pupilMat = new THREE.MeshPhongMaterial({ color: 0x001a33, specular: 0x00e5ff, shininess: 200 });
        this.leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        this.leftPupil.position.set(0, 0, 0.2);
        this.leftEyeWhite.add(this.leftPupil);

        this.rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        this.rightPupil.position.set(0, 0, 0.2);
        this.rightEyeWhite.add(this.rightPupil);

        // Eyelids
        const eyelidGeo = new THREE.SphereGeometry(0.3, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
        const eyelidMat = new THREE.MeshPhongMaterial({ color: 0x1e1e3a, specular: 0x444466, shininess: 60 });
        this.leftEyelid = new THREE.Mesh(eyelidGeo, eyelidMat);
        this.leftEyelid.position.set(-0.35, 0.15, 0.86);
        this.leftEyelid.rotation.x = Math.PI;
        this.head.add(this.leftEyelid);

        this.rightEyelid = new THREE.Mesh(eyelidGeo, eyelidMat);
        this.rightEyelid.position.set(0.35, 0.15, 0.86);
        this.rightEyelid.rotation.x = Math.PI;
        this.head.add(this.rightEyelid);

        // Brows
        const browGeo = new THREE.BoxGeometry(0.3, 0.05, 0.05);
        this.leftBrow = new THREE.Mesh(browGeo, this.accentMat.clone());
        this.leftBrow.position.set(-0.35, 0.5, 0.8);
        this.head.add(this.leftBrow);

        this.rightBrow = new THREE.Mesh(browGeo, this.accentMat.clone());
        this.rightBrow.position.set(0.35, 0.5, 0.8);
        this.head.add(this.rightBrow);

        // Mouth
        const mouthShape = new THREE.Shape();
        mouthShape.absarc(0, 0, 0.15, 0, Math.PI, false);
        const mouthGeo = new THREE.ShapeGeometry(mouthShape);
        this.mouthMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
        this.mouth = new THREE.Mesh(mouthGeo, this.mouthMat);
        this.mouth.position.set(0, -0.35, 0.95);
        this.head.add(this.mouth);

        // BODY
        const bodyGeo = new THREE.SphereGeometry(0.6, 32, 32);
        this.body = new THREE.Mesh(bodyGeo, this.metallicMat);
        this.body.position.y = -1.2;
        this.body.castShadow = true;
        this.body.receiveShadow = true;
        this.character.add(this.body);

        // Chest Glow
        const chestGeo = new THREE.SphereGeometry(0.15, 32, 32);
        this.chestMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.8 });
        this.chest = new THREE.Mesh(chestGeo, this.chestMat);
        this.chest.position.set(0, 0.1, 0.5);
        this.body.add(this.chest);

        // HANDS
        const handGeo = new THREE.SphereGeometry(0.22, 32, 32);
        const handMat = new THREE.MeshPhongMaterial({ color: 0x1e3040, specular: 0x66aacc, shininess: 60 });
        this.leftHand = new THREE.Mesh(handGeo, handMat);
        this.leftHand.position.set(-1.1, -0.3, 0.3);
        this.character.add(this.leftHand);

        this.rightHand = new THREE.Mesh(handGeo, handMat);
        this.rightHand.position.set(1.1, -0.3, 0.3);
        this.character.add(this.rightHand);

        // Fingers
        const fingerGeo = new THREE.SphereGeometry(0.08, 16, 16);
        const addFingers = (hand) => {
            const offsets = [[-0.12, 0.1, 0.05], [0, 0.14, 0.05], [0.12, 0.1, 0.05]];
            offsets.forEach(([x, y, z]) => {
                const finger = new THREE.Mesh(fingerGeo, handMat);
                finger.position.set(x, y, z);
                hand.add(finger);
            });
        };
        addFingers(this.leftHand);
        addFingers(this.rightHand);

        // Arms (Dynamic cylinders)
        this.armMat = this.metallicMat.clone();
        this.leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 16), this.armMat);
        this.character.add(this.leftArm);
        this.rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 16), this.armMat);
        this.character.add(this.rightArm);

        // ANTENNA
        this.antennaStick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 16), this.metallicMat);
        this.antennaStick.position.set(0, 1.2, 0);
        this.character.add(this.antennaStick);

        this.antennaBallMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.95 });
        this.antennaBall = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 32), this.antennaBallMat);
        this.antennaBall.position.set(0, 1.5, 0);
        this.character.add(this.antennaBall);

        // Sparkles Particles
        this.sparkCount = 80;
        this.sparkGeo = new THREE.BufferGeometry();
        this.sparkPos = new Float32Array(this.sparkCount * 3);
        this.sparkBase = new Float32Array(this.sparkCount * 3);
        for (let i = 0; i < this.sparkCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 2 + Math.random() * 1.5;
            this.sparkPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            this.sparkPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) - 0.3;
            this.sparkPos[i * 3 + 2] = r * Math.cos(phi);
            this.sparkBase[i * 3] = this.sparkPos[i * 3];
            this.sparkBase[i * 3 + 1] = this.sparkPos[i * 3 + 1];
            this.sparkBase[i * 3 + 2] = this.sparkPos[i * 3 + 2];
        }
        this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3));
        this.sparkMat = new THREE.PointsMaterial({ size: 0.04, color: 0x00e5ff, transparent: true, opacity: 0.3 });
        this.sparkles = new THREE.Points(this.sparkGeo, this.sparkMat);
        this.scene.add(this.sparkles);

        this.clock = new THREE.Clock();
    }

    setState(state) {
        this.state = state;
        if (state === 'approved') this.v.celebrationPhase = 0;
    }

    setTypingActivity(activity) { this.typingActivity = activity; }
    setKeystrokePulse(pulse) {
        if (pulse !== this.lastPulse) {
            this.v.keystrokeBump = 0.2;
            this.lastPulse = pulse;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const time = this.clock.getElapsedTime();
        const v = this.v;
        const st = this.state;
        const typing = this.typingActivity;

        v.keystrokeBump *= 0.85;

        // Blinking
        v.blinkTimer += 0.016;
        if (!v.isBlinking && v.blinkTimer > 2.5 + Math.random() * 3) {
            v.isBlinking = true; v.blinkTimer = 0;
        }
        if (v.isBlinking && v.blinkTimer > 0.15) {
            v.isBlinking = false; v.blinkTimer = 0;
        }

        // State Targets
        let tHTX = 0, tHTZ = 0, tESY = 1, tPX = 0, tPY = 0;
        let tLHX = -1.1, tLHY = -0.3, tLHZ = 0.3;
        let tRHX = 1.1, tRHY = -0.3, tRHZ = 0.3;
        let tMS = 0.5, tAR = 0.0, tAG = 0.89, tAB = 1.0;
        let tAW = Math.sin(time * 2) * 0.1, tHS = 1, tBS = 1, tBY = 0.35, tBR = 0;

        const breathe = Math.sin(time * 1.8) * 0.03;
        v.breathe = breathe;

        if (st === 'idle') {
            const hue = (time * 0.1) % 1;
            const idleColor = new THREE.Color().setHSL(hue, 0.8, 0.6);
            tAR = idleColor.r; tAG = idleColor.g; tAB = idleColor.b;
            tHTX = Math.sin(time * 0.5) * 0.05;
            tHTZ = Math.sin(time * 0.7) * 0.03;
        } else if (st === 'watching') {
            tAR = 0.0; tAG = 0.89; tAB = 1.0;
            tHTX = 0.15 + typing * 0.1;
            tESY = 1.2 + typing * 0.15;
            tPX = Math.sin(time * 8 + v.keystrokeBump * 20) * 0.06 * (0.5 + typing);
            tLHY = -0.1 + typing * 0.15; tRHY = -0.1 + typing * 0.15;
            tBY = 0.45;
        } else if (st === 'alert') {
            tAR = 0.39; tAG = 0.4; tAB = 0.95;
            tHTX = -0.1; tESY = 0.6 - typing * 0.3;
            tLHX = -0.4; tLHY = 0.15; tLHZ = 0.9;
            tRHX = 0.4; tRHY = 0.15; tRHZ = 0.9;
            tHS = 1.15; tBR = 0.2;
        } else if (st === 'scanning') {
            tAR = 0.67; tAG = 0.55; tAB = 0.98;
            tPX = Math.cos(time * 12) * 0.1; tPY = Math.sin(time * 12) * 0.1;
            tLHX = -1.3; tRHX = 1.3; tLHY = 0.2; tRHY = 0.2;
            tAW = Math.sin(time * 15) * 0.2; tBS = 1 + Math.sin(time * 20) * 0.02;
        } else if (st === 'approved') {
            tAR = 0.06; tAG = 0.72; tAB = 0.51;
            v.celebrationPhase += 0.016;
            tHTX = Math.sin(v.celebrationPhase * 8) * 0.1;
            tESY = 0.3; tMS = 0.9;
            tLHY = 1.2 + Math.sin(time * 6) * 0.2; tRHY = 1.2 + Math.sin(time * 6 + 1) * 0.2;
            v.bounce = Math.abs(Math.sin(v.celebrationPhase * 5)) * 0.3;
        }

        // Apply Lerp & Transforms
        const L = 0.06, FL = 0.1;
        const lerp = (c, t, s) => c + (t - c) * s;
        v.headTiltX = lerp(v.headTiltX, tHTX, FL);
        v.eyeScaleY = lerp(v.eyeScaleY, v.isBlinking ? 0.1 : tESY, v.isBlinking ? 0.4 : FL);
        v.leftHandX = lerp(v.leftHandX, tLHX, L); v.leftHandY = lerp(v.leftHandY, tLHY, L);
        v.rightHandX = lerp(v.rightHandX, tRHX, L); v.rightHandY = lerp(v.rightHandY, tRHY, L);
        v.accentR = lerp(v.accentR, tAR, 0.03); v.accentG = lerp(v.accentG, tAG, 0.03); v.accentB = lerp(v.accentB, tAB, 0.03);

        const accentColor = new THREE.Color(v.accentR, v.accentG, v.accentB);
        this.character.position.y = v.bounce + v.breathe;
        this.head.rotation.x = v.headTiltX;
        this.leftEyeWhite.scale.set(1, v.eyeScaleY, 1);
        this.rightEyeWhite.scale.set(1, v.eyeScaleY, 1);
        this.leftPupil.position.set(lerp(v.pupilX, tPX, FL), lerp(v.pupilY, tPY, FL), 0.2);
        this.rightPupil.position.copy(this.leftPupil.position);
        this.leftIris.material.color.copy(accentColor);
        this.rightIris.material.color.copy(accentColor);
        this.leftEyelid.rotation.x = Math.PI + v.headTiltX;
        this.rightEyelid.rotation.x = Math.PI + v.headTiltX;
        this.antennaBallMat.color.copy(accentColor);
        this.keyLight.color.copy(accentColor);

        this.leftHand.position.set(v.leftHandX, v.leftHandY, v.leftHandZ);
        this.rightHand.position.set(v.rightHandX, v.rightHandY, v.rightHandZ);

        this.updateArm(this.leftArm, this.leftHand.position, true);
        this.updateArm(this.rightArm, this.rightHand.position, false);

        this.renderer.render(this.scene, this.camera);
    }

    updateArm(arm, handPos, isLeft) {
        const bodySide = new THREE.Vector3(isLeft ? -0.4 : 0.4, -1.0 + this.v.breathe * 0.5, 0);
        const midPoint = new THREE.Vector3().addVectors(bodySide, handPos).multiplyScalar(0.5);
        arm.position.copy(midPoint);
        arm.lookAt(handPos);
        arm.rotateX(Math.PI / 2);
        const dist = bodySide.distanceTo(handPos);
        arm.scale.set(1, dist * 1.6, 1);
    }

    onWindowResize() {
        const W = this.container.clientWidth;
        const H = this.container.clientHeight;
        this.camera.aspect = W / H;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(W, H);
    }

    // React Legacy methods for compatibility
    reactSuccess() { this.setState('approved'); }
    reactFailure() { this.setState('idle'); setTimeout(() => this.setState('idle'), 2000); }
}
