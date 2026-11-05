import * as THREE from 'three';
import { petManager } from './petManager';
import { sound } from './sound';

// Pre-allocated scratch helpers to guarantee zero GC in update()
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

/**
 * 3D Composite Procedural Daily Streak Shrine & 24-Hour Reward Chest.
 * Built with 8 distinct parts across Primary Silhouette, Secondary Read, and Accent Detail:
 * 1. Soft radial contact shadow plane at bottom-center pivot (y = 0)
 * 2. Turned stone/marble pedestal base (`LatheGeometry`, roughness 0.72, metalness 0.08)
 * 3. Brushed gold trim collar (`TorusGeometry`, roughness 0.18, metalness 0.92)
 * 4. Beveled treasure chest lower hull (`ExtrudeGeometry`, roughness 0.42, metalness 0.25)
 * 5. Articulated beveled chest lid (`ExtrudeGeometry` in pivot group for damped opening)
 * 6. Ornate front lock clasp (`ExtrudeGeometry`, brushed gold)
 * 7. Levitating multi-part Streak Flame Crystal (`LatheGeometry` + inner core)
 * 8. `InstancedMesh` of 24 orbiting golden embers (>20 repeated items)
 * 9. Procedural `CanvasTexture` (`SRGBColorSpace`) status plaque showing streak count & 24h countdown
 */
export class DailyStreakShrine extends THREE.Group {
  private lidPivot: THREE.Group;
  private flameGroup: THREE.Group;
  private emberInstancedMesh: THREE.InstancedMesh;
  private plaqueCanvas: HTMLCanvasElement;
  private plaqueTexture: THREE.CanvasTexture;
  private plaqueMesh: THREE.Mesh;

  // Materials
  private stoneMaterial: THREE.MeshStandardMaterial;
  private goldMaterial: THREE.MeshStandardMaterial;
  private chestWoodMaterial: THREE.MeshStandardMaterial;
  private flameOuterMaterial: THREE.MeshPhysicalMaterial;
  private flameCoreMaterial: THREE.MeshBasicMaterial;
  private shadowMaterial: THREE.MeshBasicMaterial;

  // Animation & damping state
  private animTime: number = 0;
  private lidOpenAngle: number = 0;
  private targetLidOpenAngle: number = 0;
  private flameScale: number = 1.0;
  private targetFlameScale: number = 1.0;
  private burstBoost: number = 0;
  private lastPlaqueRefresh: number = 0;

  // Ember orbit parameters
  private readonly emberCount = 24;
  private emberAngles: Float32Array;
  private emberRadii: Float32Array;
  private emberHeights: Float32Array;
  private emberSpeeds: Float32Array;

  constructor() {
    super();
    this.name = 'DailyStreakShrine';
    this.xb = { manipulation: true };

    this.emberAngles = new Float32Array(this.emberCount);
    this.emberRadii = new Float32Array(this.emberCount);
    this.emberHeights = new Float32Array(this.emberCount);
    this.emberSpeeds = new Float32Array(this.emberCount);

    // 1. Varied PBR Materials (roughness varied >= 0.25 across adjacent parts)
    this.stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x2b3040,
      roughness: 0.75,
      metalness: 0.08,
    });

    this.chestWoodMaterial = new THREE.MeshStandardMaterial({
      color: 0x6b2d5c,
      roughness: 0.45,
      metalness: 0.2,
    });

    this.goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xffcf40,
      roughness: 0.16,
      metalness: 0.92,
    });

    this.flameOuterMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xff5500,
      emissive: 0xff3300,
      emissiveIntensity: 0.85,
      roughness: 0.12,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: 0.9,
    });

    this.flameCoreMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff3b0,
    });

    // 2. Soft Radial Contact Shadow at y = 0.005 (bottom-center grounded pivot)
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
      grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.22)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    this.shadowMaterial = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), this.shadowMaterial);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.005;
    this.add(shadowPlane);

    // 3. Primary Silhouette: Turned Pedestal Base (LatheGeometry)
    const lathePoints = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.14, 0.0),
      new THREE.Vector2(0.15, 0.025),
      new THREE.Vector2(0.12, 0.04),
      new THREE.Vector2(0.095, 0.12),
      new THREE.Vector2(0.125, 0.15),
      new THREE.Vector2(0.135, 0.175),
      new THREE.Vector2(0.0, 0.175),
    ];
    const pedestalGeo = new THREE.LatheGeometry(lathePoints, 28);
    const pedestalMesh = new THREE.Mesh(pedestalGeo, this.stoneMaterial);
    pedestalMesh.castShadow = true;
    pedestalMesh.receiveShadow = true;
    this.add(pedestalMesh);

    // 4. Secondary Read: Brushed Gold Pedestal Collar & Pillar Rings
    const collarGeo = new THREE.TorusGeometry(0.128, 0.01, 12, 28);
    const collarMesh = new THREE.Mesh(collarGeo, this.goldMaterial);
    collarMesh.rotation.x = Math.PI / 2;
    collarMesh.position.y = 0.16;
    this.add(collarMesh);

    const baseRingGeo = new THREE.TorusGeometry(0.142, 0.008, 10, 28);
    const baseRingMesh = new THREE.Mesh(baseRingGeo, this.goldMaterial);
    baseRingMesh.rotation.x = Math.PI / 2;
    baseRingMesh.position.y = 0.025;
    this.add(baseRingMesh);

    // 5. Secondary Read: Beveled Treasure Chest Lower Hull (ExtrudeGeometry)
    const boxShape = new THREE.Shape();
    const bw = 0.085;
    const bh = 0.045;
    boxShape.moveTo(-bw, 0);
    boxShape.lineTo(bw, 0);
    boxShape.lineTo(bw, bh);
    boxShape.lineTo(-bw, bh);
    boxShape.closePath();

    const chestExtrudeOpts: THREE.ExtrudeGeometryOptions = {
      steps: 1,
      depth: 0.11,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 3,
    };
    const chestBaseGeo = new THREE.ExtrudeGeometry(boxShape, chestExtrudeOpts);
    chestBaseGeo.translate(0, 0, -0.055);
    const chestBaseMesh = new THREE.Mesh(chestBaseGeo, this.chestWoodMaterial);
    chestBaseMesh.position.y = 0.18;
    chestBaseMesh.castShadow = true;
    chestBaseMesh.receiveShadow = true;
    this.add(chestBaseMesh);

    // 6. Articulated Chest Lid Pivot + Beveled Lid Arch (ExtrudeGeometry)
    this.lidPivot = new THREE.Group();
    this.lidPivot.position.set(0, 0.228, -0.055);
    this.add(this.lidPivot);

    const lidShape = new THREE.Shape();
    lidShape.moveTo(-bw, 0);
    lidShape.lineTo(bw, 0);
    lidShape.absarc(0, 0, bw, 0, Math.PI, false);
    lidShape.closePath();

    const lidGeo = new THREE.ExtrudeGeometry(lidShape, {
      steps: 1,
      depth: 0.11,
      bevelEnabled: true,
      bevelThickness: 0.007,
      bevelSize: 0.007,
      bevelSegments: 3,
    });
    const lidMesh = new THREE.Mesh(lidGeo, this.chestWoodMaterial);
    lidMesh.scale.y = 0.55;
    lidMesh.castShadow = true;
    this.lidPivot.add(lidMesh);

    // Gold strap bands on lid
    for (const xOff of [-0.055, 0.055]) {
      const strap = new THREE.Mesh(
        new THREE.BoxGeometry(0.014, 0.055, 0.125),
        this.goldMaterial
      );
      strap.position.set(xOff, 0.022, 0.055);
      this.lidPivot.add(strap);
    }

    // 7. Accent Detail: Ornate Front Lock Clasp
    const lockShape = new THREE.Shape();
    lockShape.moveTo(-0.018, -0.02);
    lockShape.lineTo(0.018, -0.02);
    lockShape.lineTo(0.022, 0.015);
    lockShape.lineTo(0, 0.028);
    lockShape.lineTo(-0.022, 0.015);
    lockShape.closePath();

    const lockGeo = new THREE.ExtrudeGeometry(lockShape, {
      steps: 1,
      depth: 0.01,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.003,
      bevelSegments: 2,
    });
    const lockMesh = new THREE.Mesh(lockGeo, this.goldMaterial);
    lockMesh.position.set(0, 0.225, 0.062);
    this.add(lockMesh);

    // 8. Levitating Multi-Part Streak Flame Crystal (LatheGeometry teardrop flame)
    this.flameGroup = new THREE.Group();
    this.flameGroup.position.set(0, 0.35, 0);
    this.add(this.flameGroup);

    const flameProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.035, 0.015),
      new THREE.Vector2(0.048, 0.045),
      new THREE.Vector2(0.032, 0.095),
      new THREE.Vector2(0.012, 0.135),
      new THREE.Vector2(0.0, 0.16),
    ];
    const flameGeo = new THREE.LatheGeometry(flameProfile, 20);
    flameGeo.translate(0, -0.06, 0);
    const flameOuter = new THREE.Mesh(flameGeo, this.flameOuterMaterial);
    this.flameGroup.add(flameOuter);

    const coreGeo = new THREE.OctahedronGeometry(0.026, 1);
    const flameCore = new THREE.Mesh(coreGeo, this.flameCoreMaterial);
    flameCore.scale.set(0.8, 1.4, 0.8);
    this.flameGroup.add(flameCore);

    // Orbiting gold gyro ring around flame
    const gyroRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.068, 0.004, 8, 24),
      this.goldMaterial
    );
    gyroRing.rotation.x = Math.PI / 3;
    this.flameGroup.add(gyroRing);

    // 9. InstancedMesh of 24 Orbiting Golden Streak Embers (> 20 identical items)
    const emberGeo = new THREE.OctahedronGeometry(0.009, 0);
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.emberInstancedMesh = new THREE.InstancedMesh(emberGeo, emberMat, this.emberCount);
    this.emberInstancedMesh.frustumCulled = false;

    for (let i = 0; i < this.emberCount; i++) {
      this.emberAngles[i] = (i / this.emberCount) * Math.PI * 2;
      this.emberRadii[i] = 0.09 + Math.random() * 0.08;
      this.emberHeights[i] = 0.22 + Math.random() * 0.24;
      this.emberSpeeds[i] = 1.2 + Math.random() * 1.8;

      // Tint variation per instance
      _color.setHSL(0.06 + Math.random() * 0.08, 1.0, 0.55 + Math.random() * 0.25);
      this.emberInstancedMesh.setColorAt(i, _color);
    }
    if (this.emberInstancedMesh.instanceColor) {
      this.emberInstancedMesh.instanceColor.needsUpdate = true;
    }
    this.add(this.emberInstancedMesh);

    // 10. Floating Procedural CanvasTexture Plaque (SRGBColorSpace)
    this.plaqueCanvas = document.createElement('canvas');
    this.plaqueCanvas.width = 512;
    this.plaqueCanvas.height = 160;
    this.plaqueTexture = new THREE.CanvasTexture(this.plaqueCanvas);
    this.plaqueTexture.colorSpace = THREE.SRGBColorSpace;

    const plaqueMat = new THREE.MeshBasicMaterial({
      map: this.plaqueTexture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.plaqueMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13), plaqueMat);
    this.plaqueMesh.position.set(0, 0.53, 0);
    this.add(this.plaqueMesh);

    this.syncWithStreakState();
    this.drawPlaque();
  }

  public syncWithStreakState() {
    const isAvailable = petManager.isStreakRewardAvailable();
    const state = petManager.getState();

    // Open chest lid & enlarge flame when 24h reward is ready to be claimed!
    this.targetLidOpenAngle = isAvailable ? -0.95 : -0.15;
    this.targetFlameScale = isAvailable ? 1.28 : 0.88 + Math.min(state.dailyStreak * 0.05, 0.35);

    if (isAvailable) {
      this.flameOuterMaterial.color.setHex(0xff6d00);
      this.flameOuterMaterial.emissive.setHex(0xff4500);
      this.flameOuterMaterial.emissiveIntensity = 1.2;
    } else {
      this.flameOuterMaterial.color.setHex(0x00f5d4);
      this.flameOuterMaterial.emissive.setHex(0x00bbf9);
      this.flameOuterMaterial.emissiveIntensity = 0.7;
    }

    this.drawPlaque();
  }

  public triggerCelebrationBurst() {
    this.burstBoost = 1.0;
    this.targetLidOpenAngle = -1.15;
    this.targetFlameScale = 1.65;
    sound.playLevelUp();
    setTimeout(() => {
      this.syncWithStreakState();
    }, 1800);
  }

  private drawPlaque() {
    const ctx = this.plaqueCanvas.getContext('2d');
    if (!ctx) return;

    const state = petManager.getState();
    const isReady = petManager.isStreakRewardAvailable();
    const countdown = petManager.getStreakCountdownFormatted();

    ctx.clearRect(0, 0, 512, 160);

    // Badge card
    ctx.fillStyle = isReady ? 'rgba(45, 18, 8, 0.92)' : 'rgba(14, 22, 38, 0.9)';
    ctx.strokeStyle = isReady ? '#ff9e00' : '#00f5d4';
    ctx.lineWidth = 5;

    const r = 24;
    ctx.beginPath();
    ctx.roundRect(12, 12, 488, 136, r);
    ctx.fill();
    ctx.stroke();

    // Title line
    ctx.font = 'bold 34px "Google Sans", sans-serif';
    ctx.fillStyle = isReady ? '#ffd166' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`🔥 ${state.dailyStreak} DAY STREAK (BEST: ${state.bestStreak})`, 256, 62);

    // Subtitle countdown / action prompt
    ctx.font = 'bold 24px "Google Sans", sans-serif';
    ctx.fillStyle = isReady ? '#ff9e00' : '#8ef5b5';
    ctx.fillText(countdown, 256, 112);

    this.plaqueTexture.needsUpdate = true;
  }

  public update(deltaTime: number, camera?: THREE.Camera) {
    this.animTime += deltaTime;

    // Refresh countdown timer on 3D plaque once per second
    if (this.animTime - this.lastPlaqueRefresh >= 1.0) {
      this.lastPlaqueRefresh = this.animTime;
      this.syncWithStreakState();
    }

    // Frame-rate independent exponential damping for chest lid and flame scale
    this.lidOpenAngle = THREE.MathUtils.damp(
      this.lidOpenAngle,
      this.targetLidOpenAngle,
      6.0,
      deltaTime
    );
    this.lidPivot.rotation.x = this.lidOpenAngle;

    this.flameScale = THREE.MathUtils.damp(
      this.flameScale,
      this.targetFlameScale,
      5.0,
      deltaTime
    );
    this.burstBoost = THREE.MathUtils.damp(this.burstBoost, 0, 3.0, deltaTime);

    this.flameGroup.scale.setScalar(this.flameScale);
    this.flameGroup.position.y = 0.34 + Math.sin(this.animTime * 3.2) * 0.025;
    this.flameGroup.rotation.y += deltaTime * (1.8 + this.burstBoost * 8.0);

    // Update all 24 InstancedMesh embers with zero GC allocations
    for (let i = 0; i < this.emberCount; i++) {
      this.emberAngles[i] += deltaTime * this.emberSpeeds[i] * (1 + this.burstBoost * 3.0);
      const angle = this.emberAngles[i];
      const rad = this.emberRadii[i] * (1 + this.burstBoost * 0.8);
      const yBob = Math.sin(this.animTime * 2.5 + i) * 0.04;

      _dummy.position.set(
        Math.cos(angle) * rad,
        this.emberHeights[i] + yBob,
        Math.sin(angle) * rad
      );
      _dummy.rotation.set(this.animTime * 2 + i, this.animTime * 3, 0);
      const s = 0.85 + 0.3 * Math.sin(this.animTime * 4 + i);
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();

      this.emberInstancedMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.emberInstancedMesh.instanceMatrix.needsUpdate = true;

    if (camera) {
      this.plaqueMesh.quaternion.copy(camera.quaternion);
    }
  }

  public dispose() {
    this.plaqueCanvas.remove();
    this.plaqueTexture.dispose();
    this.stoneMaterial.dispose();
    this.goldMaterial.dispose();
    this.chestWoodMaterial.dispose();
    this.flameOuterMaterial.dispose();
    this.flameCoreMaterial.dispose();
    this.shadowMaterial.dispose();
  }
}
