import * as THREE from 'three';
import { PetAccessory, PetMood, PetSpecies, PetState } from './types';
import { PET_COLORS, petManager } from './petManager';
import { FoodObject, GroomingBrush } from './toysAndFood';

// Pre-allocated scratch color for smooth mood color interpolation
const _targetMoodColor = new THREE.Color();
const _targetAccentColor = new THREE.Color();

export class PetRenderer extends THREE.Group {
  private bodyGroup: THREE.Group;
  private headGroup: THREE.Group;
  private faceGroup: THREE.Group;
  private accessoryGroup: THREE.Group;
  private particlesGroup: THREE.Group;

  // Species feature groups
  private earsGroup: THREE.Group;
  private wingsGroup: THREE.Group;
  private tailGroup: THREE.Group;
  private hornsGroup: THREE.Group;

  // 3D Visual Mood Indicator System Groups
  private moodIndicatorGroup: THREE.Group;
  private moodCrystalMesh!: THREE.Mesh;
  private moodOuterRingMesh!: THREE.Mesh;
  private moodInnerRingMesh!: THREE.Mesh;
  private hungerSatelliteGroup: THREE.Group;
  private sadTearSatelliteGroup: THREE.Group;
  private ecstaticStarSatelliteGroup: THREE.Group;

  // Grounded 3D Mood Aura Ring beneath pet
  private moodAuraGroup: THREE.Group;
  private moodAuraRingMesh!: THREE.Mesh;
  private moodAuraDiscMesh!: THREE.Mesh;

  // Mood Materials
  private moodCrystalMaterial: THREE.MeshStandardMaterial;
  private moodRingMaterial: THREE.MeshBasicMaterial;
  private moodAuraRingMaterial: THREE.MeshBasicMaterial;
  private moodAuraDiscMaterial: THREE.MeshBasicMaterial;

  // Materials (Upgraded to MeshPhysicalMaterial for smooth velvet sheen & clearcoat)
  private bodyMaterial: THREE.MeshPhysicalMaterial;
  private secondaryMaterial: THREE.MeshPhysicalMaterial;
  private eyeMaterial: THREE.MeshPhysicalMaterial;
  private pupilMaterial: THREE.MeshPhysicalMaterial;
  private cheekMaterial: THREE.MeshStandardMaterial;
  private goldMaterial: THREE.MeshPhysicalMaterial;

  // Body & Face meshes for dynamic mood posture & expressions
  private bellyMesh?: THREE.Mesh;
  private leftArmMesh?: THREE.Mesh;
  private rightArmMesh?: THREE.Mesh;
  private leftEyeMesh?: THREE.Mesh;
  private rightEyeMesh?: THREE.Mesh;
  private leftPupilMesh?: THREE.Mesh;
  private rightPupilMesh?: THREE.Mesh;
  private leftBrowMesh?: THREE.Mesh;
  private rightBrowMesh?: THREE.Mesh;
  private leftCheek?: THREE.Mesh;
  private rightCheek?: THREE.Mesh;
  private mouthMesh?: THREE.Mesh;

  // Speech & Mood HUD billboard
  private speechCanvas: HTMLCanvasElement;
  private speechTexture: THREE.CanvasTexture;
  private speechMesh: THREE.Mesh;
  private lastRenderedHudSignature: string = '';
  private lastModelSignature: string = '';

  // Animation states
  private animTime: number = 0;
  private blinkTimer: number = 3;
  private isBlinking: boolean = false;
  private blinkProgress: number = 0;
  private flipTime: number = 0;
  private isFlipping: boolean = false;
  private currentScaleTarget: number = 1.0;
  private ambientMoodParticleTimer: number = 0;

  // 3D Feeding Animation state
  private feedingPropGroup: THREE.Group;
  private activeFoodProp?: FoodObject;
  private isEatingAnim: boolean = false;
  private eatingAnimTime: number = 0;
  private eatingBiteStage: number = 0;
  private eatingSnackType: 'apple' | 'cake' | 'sushi' | 'cookie' = 'apple';

  // 3D Grooming / Brushing Animation state
  private groomingPropGroup: THREE.Group;
  private activeBrushProp?: GroomingBrush;
  private isGroomingAnim: boolean = false;
  private groomingAnimTime: number = 0;
  private groomingStrokeStage: number = 0;

  // Particles
  private activeParticles: Array<{
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    rotSpeed: number;
  }> = [];

  constructor() {
    super();
    this.name = 'TamagotchiPet';

    // Interactive hit box for raycast & direct pinch/touch
    this.xb = { manipulation: true };

    this.bodyGroup = new THREE.Group();
    this.headGroup = new THREE.Group();
    this.faceGroup = new THREE.Group();
    this.accessoryGroup = new THREE.Group();
    this.particlesGroup = new THREE.Group();
    this.earsGroup = new THREE.Group();
    this.wingsGroup = new THREE.Group();
    this.tailGroup = new THREE.Group();
    this.hornsGroup = new THREE.Group();

    this.moodIndicatorGroup = new THREE.Group();
    this.hungerSatelliteGroup = new THREE.Group();
    this.sadTearSatelliteGroup = new THREE.Group();
    this.ecstaticStarSatelliteGroup = new THREE.Group();
    this.moodAuraGroup = new THREE.Group();
    this.feedingPropGroup = new THREE.Group();
    this.groomingPropGroup = new THREE.Group();

    // High-fidelity smooth PBR materials with soft velvet sheen & vinyl clearcoat
    this.bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xff85a2,
      roughness: 0.32,
      metalness: 0.04,
      clearcoat: 0.42,
      clearcoatRoughness: 0.22,
      sheen: 0.65,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color(0xffd1dc),
      flatShading: false,
    });
    this.secondaryMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffb3c6,
      roughness: 0.36,
      metalness: 0.02,
      clearcoat: 0.32,
      clearcoatRoughness: 0.25,
      sheen: 0.55,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color(0xffffff),
      flatShading: false,
    });
    this.eyeMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.05,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    });
    this.pupilMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x161426,
      roughness: 0.04,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
    });
    this.cheekMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4d79,
      emissive: 0xff4d79,
      emissiveIntensity: 0.28,
      roughness: 0.45,
      transparent: true,
      opacity: 0.72,
    });
    this.goldMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf4c430,
      metalness: 0.88,
      roughness: 0.16,
      clearcoat: 0.6,
      clearcoatRoughness: 0.15,
    });

    // Mood Indicator Materials
    this.moodCrystalMaterial = new THREE.MeshStandardMaterial({
      color: 0x00f5d4,
      emissive: 0x00f5d4,
      emissiveIntensity: 0.55,
      roughness: 0.12,
      metalness: 0.35,
    });
    this.moodRingMaterial = new THREE.MeshBasicMaterial({
      color: 0x48cae4,
      transparent: true,
      opacity: 0.8,
    });
    this.moodAuraRingMaterial = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.moodAuraDiscMaterial = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.add(this.moodAuraGroup);
    this.add(this.bodyGroup);
    this.bodyGroup.add(this.headGroup);
    this.headGroup.add(this.faceGroup);
    this.headGroup.add(this.earsGroup);
    this.headGroup.add(this.wingsGroup);
    this.headGroup.add(this.tailGroup);
    this.headGroup.add(this.hornsGroup);
    this.headGroup.add(this.accessoryGroup);
    this.add(this.feedingPropGroup);
    this.add(this.groomingPropGroup);
    this.add(this.moodIndicatorGroup);
    this.add(this.particlesGroup);

    // Build 3D Mood Indicator Plumbob, Satellites & Ground Aura
    this.buildMoodIndicatorSystem();

    // High-DPI Speech & Mood HUD 2D canvas billboard
    this.speechCanvas = document.createElement('canvas');
    this.speechCanvas.width = 1280;
    this.speechCanvas.height = 440;
    this.speechTexture = new THREE.CanvasTexture(this.speechCanvas);
    this.speechTexture.colorSpace = THREE.SRGBColorSpace;
    this.speechTexture.minFilter = THREE.LinearFilter;
    this.speechTexture.magFilter = THREE.LinearFilter;
    this.speechTexture.anisotropy = 8;

    const speechGeo = new THREE.PlaneGeometry(0.62, 0.21);
    const speechMat = new THREE.MeshBasicMaterial({
      map: this.speechTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.speechMesh = new THREE.Mesh(speechGeo, speechMat);
    this.speechMesh.position.set(0, 0.56, 0);
    this.speechMesh.xb = { pointerEvents: 'none' };
    this.add(this.speechMesh);

    this.rebuildModel(petManager.getState());

    // Automatically trigger the 3D feeding animation whenever petManager.feedPet() is invoked
    petManager.onFeedPet((snackType) => {
      this.triggerFeedingAnimation(snackType);
    });

    // Automatically trigger the 3D brushing animation whenever petManager.groomPet() is invoked
    petManager.onGroomPet(() => {
      this.triggerGroomingAnimation();
    });
  }

  /**
   * Constructs the 3D Floating Mood Plumbob Crystal, Orbiting Rings,
   * Contextual Hunger/Sadness/Ecstatic 3D Satellites, and Grounded Mood Aura Ring.
   */
  private buildMoodIndicatorSystem() {
    this.moodIndicatorGroup.position.set(0, 0.41, 0);
    this.moodIndicatorGroup.xb = { pointerEvents: 'none' };

    // 1. Central Mood Plumbob Gem (Faceted Octahedron)
    const crystalGeo = new THREE.OctahedronGeometry(0.032, 0);
    this.moodCrystalMesh = new THREE.Mesh(crystalGeo, this.moodCrystalMaterial);
    this.moodCrystalMesh.scale.set(0.85, 1.35, 0.85);
    this.moodIndicatorGroup.add(this.moodCrystalMesh);

    // 2. Dual Counter-Rotating Gyroscopic Mood Rings
    const outerRingGeo = new THREE.TorusGeometry(0.052, 0.0035, 10, 32);
    this.moodOuterRingMesh = new THREE.Mesh(outerRingGeo, this.moodRingMaterial);
    this.moodOuterRingMesh.rotation.x = Math.PI / 2;
    this.moodIndicatorGroup.add(this.moodOuterRingMesh);

    const innerRingGeo = new THREE.TorusGeometry(0.042, 0.0025, 8, 28);
    this.moodInnerRingMesh = new THREE.Mesh(innerRingGeo, this.moodRingMaterial);
    this.moodInnerRingMesh.rotation.y = Math.PI / 4;
    this.moodIndicatorGroup.add(this.moodInnerRingMesh);

    // 3. Hunger Satellite: Miniature 3D Floating Apple Icon (visible when hunger < 50)
    const miniApple = new THREE.Group();
    const appleBody = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 14, 12),
      new THREE.MeshStandardMaterial({
        color: 0xff3b30,
        emissive: 0x661100,
        roughness: 0.25,
      })
    );
    const appleStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.002, 0.002, 0.012, 6),
      new THREE.MeshBasicMaterial({ color: 0x5c3a21 })
    );
    appleStem.position.y = 0.018;
    const appleLeaf = new THREE.Mesh(
      new THREE.ConeGeometry(0.007, 0.014, 4),
      new THREE.MeshBasicMaterial({ color: 0x38ef7d })
    );
    appleLeaf.position.set(0.006, 0.019, 0);
    appleLeaf.rotation.z = -1.1;
    miniApple.add(appleBody, appleStem, appleLeaf);
    miniApple.position.set(0.085, 0, 0);
    this.hungerSatelliteGroup.add(miniApple);
    this.hungerSatelliteGroup.visible = false;
    this.moodIndicatorGroup.add(this.hungerSatelliteGroup);

    // 4. Sadness Satellite: Pair of 3D Glossy Blue Teardrops (visible when happiness < 50)
    const tearMat = new THREE.MeshStandardMaterial({
      color: 0x4ea8de,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.5,
      roughness: 0.1,
    });
    for (let i = 0; i < 2; i++) {
      const tear = new THREE.Group();
      const dropBottom = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), tearMat);
      const dropTop = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.022, 12), tearMat);
      dropTop.position.y = 0.012;
      tear.add(dropBottom, dropTop);
      tear.position.set(i === 0 ? -0.085 : 0.085, i === 0 ? 0.01 : -0.01, 0);
      this.sadTearSatelliteGroup.add(tear);
    }
    this.sadTearSatelliteGroup.visible = false;
    this.moodIndicatorGroup.add(this.sadTearSatelliteGroup);

    // 5. Ecstatic Satellites: 3 Orbiting Golden Starbursts (visible when ecstatic)
    for (let i = 0; i < 3; i++) {
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.013, 0),
        this.goldMaterial
      );
      const angle = (i / 3) * Math.PI * 2;
      star.position.set(Math.cos(angle) * 0.08, 0, Math.sin(angle) * 0.08);
      this.ecstaticStarSatelliteGroup.add(star);
    }
    this.ecstaticStarSatelliteGroup.visible = false;
    this.moodIndicatorGroup.add(this.ecstaticStarSatelliteGroup);

    // 6. Grounded 3D Mood Aura Ring & Soft Radial Contact Shadow beneath the pet's feet
    this.moodAuraGroup.position.set(0, 0.005, 0);
    this.moodAuraGroup.xb = { pointerEvents: 'none' };

    const auraRingGeo = new THREE.RingGeometry(0.19, 0.23, 64);
    auraRingGeo.rotateX(-Math.PI / 2);
    this.moodAuraRingMesh = new THREE.Mesh(auraRingGeo, this.moodAuraRingMaterial);

    const auraDiscGeo = new THREE.CircleGeometry(0.19, 64);
    auraDiscGeo.rotateX(-Math.PI / 2);
    this.moodAuraDiscMesh = new THREE.Mesh(auraDiscGeo, this.moodAuraDiscMaterial);

    // Soft radial contact shadow plane to ground the Tamagotchi smoothly
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
      grad.addColorStop(0, 'rgba(10, 8, 22, 0.52)');
      grad.addColorStop(0.55, 'rgba(10, 8, 22, 0.22)');
      grad.addColorStop(1, 'rgba(10, 8, 22, 0.0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const contactShadowGeo = new THREE.PlaneGeometry(0.36, 0.36);
    contactShadowGeo.rotateX(-Math.PI / 2);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const contactShadowMesh = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadowMesh.position.y = 0.002;

    this.moodAuraGroup.add(this.moodAuraRingMesh, this.moodAuraDiscMesh, contactShadowMesh);
  }

  public rebuildModel(state: PetState) {
    const modelSig = `${state.species}|${state.colorId}|${state.accessory}|${state.stage}`;
    if (this.lastModelSignature === modelSig) {
      this.updateSpeechBubble(false);
      return;
    }
    this.lastModelSignature = modelSig;

    // Clear dynamic groups
    this.clearGroup(this.headGroup);
    this.clearGroup(this.faceGroup);
    this.clearGroup(this.earsGroup);
    this.clearGroup(this.wingsGroup);
    this.clearGroup(this.tailGroup);
    this.clearGroup(this.hornsGroup);
    this.clearGroup(this.accessoryGroup);

    // Update colors & velvet sheen
    const colorDef = PET_COLORS[state.colorId] || PET_COLORS.pink;
    this.bodyMaterial.color.setHex(colorDef.primary);
    this.bodyMaterial.sheenColor.setHex(colorDef.glow);
    this.secondaryMaterial.color.setHex(colorDef.secondary);
    this.cheekMaterial.color.setHex(colorDef.accent);
    this.cheekMaterial.emissive.setHex(colorDef.accent);

    // Calculate scale by evolution stage
    const stageScales: Record<string, number> = {
      baby: 0.75,
      child: 0.95,
      teen: 1.15,
      adult: 1.35,
      mystic: 1.55,
    };
    this.currentScaleTarget = stageScales[state.stage] || 1.0;
    if (this.scale.x === 1 && this.animTime === 0) {
      this.scale.setScalar(this.currentScaleTarget);
    }

    // Build specific species
    this.buildBaseBody(state.species);
    this.buildFace();
    this.buildSpeciesFeatures(state.species);
    this.buildAccessory(state.accessory);
    this.updateSpeechBubble(true);
  }

  private clearGroup(group: THREE.Group) {
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      if ((obj as THREE.Mesh).geometry) {
        (obj as THREE.Mesh).geometry.dispose();
      }
    }
  }

  /**
   * Generates a high-subdivision (64x48) organic pear/mochi-shaped geometry
   * with smoothly sculpted lower cheeks, softly flattened base, and recomputed vertex normals.
   */
  private createSmoothMochiBodyGeometry(radius: number, lowerPlumpness: number = 0.08): THREE.BufferGeometry {
    const geo = new THREE.SphereGeometry(radius, 64, 48);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      // Normalized vertical coordinate (-1 at bottom, +1 at top)
      const ny = y / radius;

      // Plump out the lower-middle cheeks/tummy smoothly (squishy mochi profile)
      const plumpFactor = 1.0 + lowerPlumpness * Math.exp(-Math.pow(ny + 0.25, 2) * 3.2);
      x *= plumpFactor;
      z *= plumpFactor * 0.97;

      // Softly cushion/flatten the very bottom so the Tamagotchi sits naturally
      if (ny < -0.65) {
        const flattenT = (-0.65 - ny) / 0.35;
        y += flattenT * flattenT * radius * 0.11;
      }

      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  private buildBaseBody(species: PetSpecies) {
    const baseRadius =
      species === 'blobby'
        ? 0.18
        : species === 'pipsqueak'
          ? 0.162
          : species === 'draco'
            ? 0.172
            : 0.17;
    const plumpness =
      species === 'blobby' ? 0.11 : species === 'pipsqueak' ? 0.09 : 0.07;

    const bodyGeo = this.createSmoothMochiBodyGeometry(baseRadius, plumpness);
    const mainBody = new THREE.Mesh(bodyGeo, this.bodyMaterial);
    mainBody.position.set(0, 0.16, 0);
    mainBody.scale.set(1.0, 0.96, 0.96);
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    this.headGroup.add(mainBody);

    // Smooth Chubby Belly patch (high-segment sphere that animates tummy rumble when hungry)
    const bellyGeo = new THREE.SphereGeometry(0.132, 48, 36);
    this.bellyMesh = new THREE.Mesh(bellyGeo, this.secondaryMaterial);
    this.bellyMesh.position.set(0, 0.138, 0.082);
    this.bellyMesh.scale.set(0.86, 0.88, 0.42);
    this.bellyMesh.castShadow = true;
    this.bellyMesh.receiveShadow = true;
    this.headGroup.add(this.bellyMesh);

    // Smooth Chubby Arms / Nubbins on left and right sides
    const armGeo = new THREE.CapsuleGeometry(0.025, 0.036, 16, 28);
    this.leftArmMesh = new THREE.Mesh(armGeo, this.bodyMaterial);
    this.leftArmMesh.position.set(-0.168, 0.145, 0.035);
    this.leftArmMesh.rotation.set(0.25, 0, 0.52);
    this.leftArmMesh.castShadow = true;

    this.rightArmMesh = new THREE.Mesh(armGeo, this.bodyMaterial);
    this.rightArmMesh.position.set(0.168, 0.145, 0.035);
    this.rightArmMesh.rotation.set(0.25, 0, -0.52);
    this.rightArmMesh.castShadow = true;
    this.headGroup.add(this.leftArmMesh, this.rightArmMesh);

    // Cute smooth rounded feet/paws
    const footGeo = new THREE.CapsuleGeometry(0.034, 0.026, 16, 28);
    footGeo.rotateX(Math.PI / 2);
    const leftFoot = new THREE.Mesh(footGeo, this.secondaryMaterial);
    leftFoot.position.set(-0.082, 0.028, 0.055);
    leftFoot.scale.set(1.05, 0.68, 1.15);
    leftFoot.castShadow = true;
    leftFoot.receiveShadow = true;

    const rightFoot = leftFoot.clone();
    rightFoot.position.x = 0.082;
    this.headGroup.add(leftFoot, rightFoot);
  }

  private buildFace() {
    // Eyes: 2 high-subdivision glossy clearcoat spheres
    const eyeGeo = new THREE.SphereGeometry(0.039, 40, 32);
    this.leftEyeMesh = new THREE.Mesh(eyeGeo, this.eyeMaterial);
    this.leftEyeMesh.position.set(-0.065, 0.19, 0.144);
    this.leftEyeMesh.scale.set(1, 1.15, 0.52);

    this.rightEyeMesh = new THREE.Mesh(eyeGeo, this.eyeMaterial);
    this.rightEyeMesh.position.set(0.065, 0.19, 0.144);
    this.rightEyeMesh.scale.set(1, 1.15, 0.52);

    // Pupils: smooth glossy spheres
    const pupilGeo = new THREE.SphereGeometry(0.025, 32, 24);
    this.leftPupilMesh = new THREE.Mesh(pupilGeo, this.pupilMaterial);
    this.leftPupilMesh.position.set(0, 0, 0.02);
    this.leftEyeMesh.add(this.leftPupilMesh);

    this.rightPupilMesh = new THREE.Mesh(pupilGeo, this.pupilMaterial);
    this.rightPupilMesh.position.set(0, 0, 0.02);
    this.rightEyeMesh.add(this.rightPupilMesh);

    // Dual Specular Eye Catchlights (primary top-right + secondary bottom-left sparkle)
    const shineGeoMain = new THREE.SphereGeometry(0.0095, 16, 14);
    const shineGeoSub = new THREE.SphereGeometry(0.0048, 14, 12);
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const shine1Main = new THREE.Mesh(shineGeoMain, shineMat);
    shine1Main.position.set(0.0085, 0.0085, 0.021);
    const shine1Sub = new THREE.Mesh(shineGeoSub, shineMat);
    shine1Sub.position.set(-0.007, -0.0075, 0.021);
    this.leftPupilMesh.add(shine1Main, shine1Sub);

    const shine2Main = shine1Main.clone();
    const shine2Sub = shine1Sub.clone();
    this.rightPupilMesh.add(shine2Main, shine2Sub);

    // Expressive Smooth Pill-Shaped 3D Eyebrows (no sharp BoxGeometry corners)
    const browGeo = new THREE.CapsuleGeometry(0.0048, 0.032, 12, 24);
    browGeo.rotateZ(Math.PI / 2);
    const browMat = new THREE.MeshStandardMaterial({
      color: 0x22182b,
      roughness: 0.35,
    });
    this.leftBrowMesh = new THREE.Mesh(browGeo, browMat);
    this.leftBrowMesh.position.set(-0.065, 0.242, 0.148);
    this.rightBrowMesh = new THREE.Mesh(browGeo, browMat);
    this.rightBrowMesh.position.set(0.065, 0.242, 0.148);

    // Smooth Rosy Cheeks
    const cheekGeo = new THREE.SphereGeometry(0.029, 32, 24);
    this.leftCheek = new THREE.Mesh(cheekGeo, this.cheekMaterial);
    this.leftCheek.position.set(-0.112, 0.145, 0.128);
    this.leftCheek.scale.set(1.05, 0.55, 0.32);

    this.rightCheek = new THREE.Mesh(cheekGeo, this.cheekMaterial);
    this.rightCheek.position.set(0.112, 0.145, 0.128);
    this.rightCheek.scale.set(1.05, 0.55, 0.32);

    // Smooth High-Subdivision Mouth Arc with Rounded End-Caps
    const mouthGeo = new THREE.TorusGeometry(0.018, 0.0046, 20, 48, Math.PI);
    const mouthMat = new THREE.MeshStandardMaterial({
      color: 0x331122,
      roughness: 0.3,
    });
    this.mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
    const capGeo = new THREE.SphereGeometry(0.0046, 14, 14);
    const leftCap = new THREE.Mesh(capGeo, mouthMat);
    leftCap.position.set(-0.018, 0, 0);
    const rightCap = new THREE.Mesh(capGeo, mouthMat);
    rightCap.position.set(0.018, 0, 0);
    this.mouthMesh.add(leftCap, rightCap);

    this.mouthMesh.rotation.z = Math.PI;
    this.mouthMesh.position.set(0, 0.14, 0.162);

    this.faceGroup.add(
      this.leftEyeMesh,
      this.rightEyeMesh,
      this.leftBrowMesh,
      this.rightBrowMesh,
      this.leftCheek,
      this.rightCheek,
      this.mouthMesh
    );
  }

  private buildSpeciesFeatures(species: PetSpecies) {
    if (species === 'blobby') {
      // Smooth rounded bunny/mochi ears using high-segment Capsules instead of pointed cones
      const earGeo = new THREE.CapsuleGeometry(0.033, 0.068, 20, 32);
      const leftEar = new THREE.Mesh(earGeo, this.bodyMaterial);
      leftEar.position.set(-0.082, 0.315, -0.015);
      leftEar.rotation.z = 0.26;
      leftEar.rotation.x = -0.08;
      leftEar.scale.set(1.0, 1.0, 0.72);
      leftEar.castShadow = true;

      const rightEar = new THREE.Mesh(earGeo, this.bodyMaterial);
      rightEar.position.set(0.082, 0.315, -0.015);
      rightEar.rotation.z = -0.26;
      rightEar.rotation.x = -0.08;
      rightEar.scale.set(1.0, 1.0, 0.72);
      rightEar.castShadow = true;

      const innerEarGeo = new THREE.CapsuleGeometry(0.019, 0.048, 16, 24);
      const innerLeft = new THREE.Mesh(innerEarGeo, this.secondaryMaterial);
      innerLeft.position.set(0, -0.005, 0.018);
      innerLeft.scale.set(1.0, 1.0, 0.55);
      leftEar.add(innerLeft);

      const innerRight = new THREE.Mesh(innerEarGeo, this.secondaryMaterial);
      innerRight.position.set(0, -0.005, 0.018);
      innerRight.scale.set(1.0, 1.0, 0.55);
      rightEar.add(innerRight);

      this.earsGroup.add(leftEar, rightEar);

      // Cute smooth puff-ball tail
      const puffTailGeo = new THREE.SphereGeometry(0.036, 28, 24);
      const puffTail = new THREE.Mesh(puffTailGeo, this.secondaryMaterial);
      puffTail.position.set(0, 0.095, -0.165);
      this.tailGroup.add(puffTail);
    } else if (species === 'pipsqueak') {
      // Smooth rounded chick/bird bill
      const beakGeo = new THREE.SphereGeometry(0.026, 28, 24);
      const beakMat = new THREE.MeshPhysicalMaterial({
        color: 0xffaa00,
        roughness: 0.25,
        clearcoat: 0.5,
      });
      const beak = new THREE.Mesh(beakGeo, beakMat);
      beak.scale.set(1.15, 0.62, 1.1);
      beak.position.set(0, 0.165, 0.162);
      this.faceGroup.add(beak);

      // Smooth double-tuft head crest
      const crestGeo = new THREE.CapsuleGeometry(0.018, 0.045, 16, 24);
      const mainCrest = new THREE.Mesh(crestGeo, this.secondaryMaterial);
      mainCrest.position.set(0, 0.32, 0.015);
      mainCrest.rotation.x = -0.28;
      const subCrest = new THREE.Mesh(crestGeo, this.bodyMaterial);
      subCrest.scale.setScalar(0.78);
      subCrest.position.set(0.022, 0.305, 0.005);
      subCrest.rotation.set(-0.2, 0, -0.35);
      this.earsGroup.add(mainCrest, subCrest);

      // Smooth rounded feathered wings (replacing sharp BoxGeometry)
      const wingGeo = new THREE.CapsuleGeometry(0.028, 0.062, 16, 28);
      const leftWing = new THREE.Mesh(wingGeo, this.bodyMaterial);
      leftWing.scale.set(0.55, 1.0, 1.25);
      leftWing.position.set(-0.165, 0.155, 0);
      leftWing.rotation.z = -0.28;

      const rightWing = new THREE.Mesh(wingGeo, this.bodyMaterial);
      rightWing.scale.set(0.55, 1.0, 1.25);
      rightWing.position.set(0.165, 0.155, 0);
      rightWing.rotation.z = 0.28;

      this.wingsGroup.add(leftWing, rightWing);
    } else if (species === 'draco') {
      // Smooth curved dragon horns built with CatmullRomCurve3 + TubeGeometry
      for (const side of [-1, 1]) {
        const hornCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.065, 0.28, -0.02),
          new THREE.Vector3(side * 0.095, 0.33, -0.045),
          new THREE.Vector3(side * 0.085, 0.375, -0.075),
        ]);
        const hornGeo = new THREE.TubeGeometry(hornCurve, 24, 0.018, 20, false);
        const hornMesh = new THREE.Mesh(hornGeo, this.goldMaterial);
        const hornTip = new THREE.Mesh(
          new THREE.SphereGeometry(0.018, 16, 16),
          this.goldMaterial
        );
        hornTip.position.set(side * 0.085, 0.375, -0.075);
        hornMesh.add(hornTip);
        this.hornsGroup.add(hornMesh);
      }

      // Smooth rounded dragon winglets
      for (const side of [-1, 1]) {
        const wingGroup = new THREE.Group();
        const wingMembrane = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.036, 0.075, 16, 24),
          this.secondaryMaterial
        );
        wingMembrane.scale.set(0.35, 1.0, 1.25);
        const wingRim = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.012, 0.085, 12, 18),
          this.goldMaterial
        );
        wingRim.position.set(0, 0.02, 0.025);
        wingGroup.add(wingMembrane, wingRim);
        wingGroup.position.set(side * 0.155, 0.195, -0.085);
        wingGroup.rotation.set(0.45, side * -0.3, side * -1.15);
        this.wingsGroup.add(wingGroup);
      }

      // Smooth S-curved dragon tail
      const tailCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.11, -0.13),
        new THREE.Vector3(0, 0.075, -0.21),
        new THREE.Vector3(0, 0.115, -0.28),
      ]);
      const tailGeo = new THREE.TubeGeometry(tailCurve, 28, 0.024, 20, false);
      const tail = new THREE.Mesh(tailGeo, this.bodyMaterial);

      const tipGeo = new THREE.SphereGeometry(0.028, 20, 18);
      tipGeo.scale(0.85, 1.25, 0.85);
      const tip = new THREE.Mesh(tipGeo, this.goldMaterial);
      tip.position.set(0, 0.115, -0.285);
      tail.add(tip);

      this.tailGroup.add(tail);
    } else if (species === 'kitsune') {
      // Smooth rounded fox ears
      const earGeo = new THREE.CapsuleGeometry(0.035, 0.064, 20, 32);
      const leftEar = new THREE.Mesh(earGeo, this.bodyMaterial);
      leftEar.position.set(-0.088, 0.308, -0.01);
      leftEar.rotation.z = 0.32;
      leftEar.scale.set(1.0, 1.0, 0.72);

      const rightEar = new THREE.Mesh(earGeo, this.bodyMaterial);
      rightEar.position.set(0.088, 0.308, -0.01);
      rightEar.rotation.z = -0.32;
      rightEar.scale.set(1.0, 1.0, 0.72);

      const innerEarGeo = new THREE.CapsuleGeometry(0.02, 0.044, 16, 24);
      const innerLeft = new THREE.Mesh(innerEarGeo, this.secondaryMaterial);
      innerLeft.position.set(0, -0.006, 0.016);
      innerLeft.scale.set(1.0, 1.0, 0.55);
      leftEar.add(innerLeft);

      const innerRight = new THREE.Mesh(innerEarGeo, this.secondaryMaterial);
      innerRight.position.set(0, -0.006, 0.016);
      innerRight.scale.set(1.0, 1.0, 0.55);
      rightEar.add(innerRight);

      this.earsGroup.add(leftEar, rightEar);

      // Smooth forehead starlight jewel
      const jewelGeo = new THREE.OctahedronGeometry(0.022, 1);
      const jewelMat = new THREE.MeshPhysicalMaterial({
        color: 0x00f5d4,
        emissive: 0x00f5d4,
        emissiveIntensity: 0.55,
        roughness: 0.08,
        clearcoat: 1.0,
      });
      const jewel = new THREE.Mesh(jewelGeo, jewelMat);
      jewel.position.set(0, 0.252, 0.156);
      this.faceGroup.add(jewel);

      // Smooth plush twin fox tails with rounded fur tips
      for (let i = -1; i <= 1; i += 2) {
        const foxTailGroup = new THREE.Group();
        const tailBody = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.036, 0.1, 20, 28),
          this.secondaryMaterial
        );
        const tailTip = new THREE.Mesh(
          new THREE.SphereGeometry(0.034, 24, 20),
          this.eyeMaterial
        );
        tailTip.position.set(0, -0.065, 0);
        foxTailGroup.add(tailBody, tailTip);
        foxTailGroup.position.set(i * 0.072, 0.125, -0.18);
        foxTailGroup.rotation.set(-1.05, i * 0.28, 0);
        this.tailGroup.add(foxTailGroup);
      }
    }
  }

  private buildAccessory(accessory: PetAccessory) {
    if (accessory === 'none') return;

    if (accessory === 'crown') {
      const crown = new THREE.Group();
      crown.position.set(0, 0.315, 0.02);

      const baseRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.062, 0.01, 16, 36),
        this.goldMaterial
      );
      baseRing.rotation.x = Math.PI / 2;
      crown.add(baseRing);

      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.064, 0.062, 0.022, 36),
        this.goldMaterial
      );
      band.position.y = 0.01;
      crown.add(band);

      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.015, 0.038, 20),
          this.goldMaterial
        );
        spike.position.set(Math.cos(angle) * 0.062, 0.032, Math.sin(angle) * 0.062);
        crown.add(spike);

        const gem = new THREE.Mesh(
          new THREE.SphereGeometry(0.0095, 16, 16),
          new THREE.MeshPhysicalMaterial({
            color: i % 2 === 0 ? 0xff0055 : 0x00ddff,
            emissive: i % 2 === 0 ? 0x440018 : 0x003344,
            roughness: 0.1,
            clearcoat: 1.0,
          })
        );
        gem.position.set(Math.cos(angle) * 0.062, 0.053, Math.sin(angle) * 0.062);
        crown.add(gem);
      }
      this.accessoryGroup.add(crown);
    } else if (accessory === 'wizard') {
      const wizardHat = new THREE.Group();
      wizardHat.position.set(0, 0.312, 0);
      wizardHat.rotation.z = -0.15;
      wizardHat.rotation.x = -0.1;

      const hatMat = new THREE.MeshPhysicalMaterial({
        color: 0x4a154b,
        roughness: 0.45,
        sheen: 0.7,
        sheenColor: new THREE.Color(0xc49df5),
      });
      const brim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.125, 0.125, 0.014, 36),
        hatMat
      );
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.21, 36),
        hatMat
      );
      cone.position.y = 0.105;
      const tipSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 16, 16),
        this.goldMaterial
      );
      tipSphere.position.y = 0.21;

      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.022, 1),
        this.goldMaterial
      );
      star.position.set(0, 0.088, 0.062);

      wizardHat.add(brim, cone, tipSphere, star);
      this.accessoryGroup.add(wizardHat);
    } else if (accessory === 'sunglasses') {
      // Sleek rounded oval sunglasses instead of sharp boxes
      const glasses = new THREE.Group();
      glasses.position.set(0, 0.188, 0.168);

      const lensMat = new THREE.MeshPhysicalMaterial({
        color: 0x090c15,
        roughness: 0.05,
        metalness: 0.85,
        clearcoat: 1.0,
      });

      const lensGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.008, 32);
      lensGeo.rotateX(Math.PI / 2);

      const rimGeo = new THREE.TorusGeometry(0.032, 0.0038, 16, 36);

      const leftLens = new THREE.Mesh(lensGeo, lensMat);
      leftLens.scale.set(1.12, 0.88, 1);
      leftLens.position.x = -0.058;
      const leftRim = new THREE.Mesh(rimGeo, this.goldMaterial);
      leftRim.scale.set(1.12, 0.88, 1);
      leftRim.position.x = -0.058;

      const rightLens = new THREE.Mesh(lensGeo, lensMat);
      rightLens.scale.set(1.12, 0.88, 1);
      rightLens.position.x = 0.058;
      const rightRim = new THREE.Mesh(rimGeo, this.goldMaterial);
      rightRim.scale.set(1.12, 0.88, 1);
      rightRim.position.x = 0.058;

      const bridgeGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.044, 16);
      bridgeGeo.rotateZ(Math.PI / 2);
      const bridge = new THREE.Mesh(bridgeGeo, this.goldMaterial);
      bridge.position.y = 0.005;

      glasses.add(leftLens, leftRim, rightLens, rightRim, bridge);
      this.accessoryGroup.add(glasses);
    } else if (accessory === 'wings') {
      const angelWings = new THREE.Group();
      angelWings.position.set(0, 0.18, -0.14);

      const wingMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        emissive: 0xddffff,
        emissiveIntensity: 0.35,
        roughness: 0.25,
        sheen: 0.8,
        sheenColor: new THREE.Color(0xffffff),
      });

      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const feather = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.022, 0.095, 16, 24),
            wingMat
          );
          feather.scale.set(0.65, 1.0, 1.0);
          feather.position.set(side * (0.07 + i * 0.038), i * 0.028, -i * 0.018);
          feather.rotation.set(0.35, side * 0.28, side * (0.78 + i * 0.2));
          angelWings.add(feather);
        }
      }
      this.accessoryGroup.add(angelWings);
    } else if (accessory === 'bowtie') {
      const bowtie = new THREE.Group();
      bowtie.position.set(0, 0.09, 0.165);

      const bowMat = new THREE.MeshPhysicalMaterial({
        color: 0xd90429,
        roughness: 0.32,
        sheen: 0.65,
        sheenColor: new THREE.Color(0xff758f),
      });
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.016, 20, 20), bowMat);
      const lobeGeo = new THREE.CapsuleGeometry(0.018, 0.022, 16, 24);
      lobeGeo.rotateZ(Math.PI / 2);

      const leftWing = new THREE.Mesh(lobeGeo, bowMat);
      leftWing.position.x = -0.026;
      leftWing.scale.set(1.0, 1.25, 0.65);

      const rightWing = new THREE.Mesh(lobeGeo, bowMat);
      rightWing.position.x = 0.026;
      rightWing.scale.set(1.0, 1.25, 0.65);

      bowtie.add(knot, leftWing, rightWing);
      this.accessoryGroup.add(bowtie);
    } else if (accessory === 'flower') {
      const flower = new THREE.Group();
      flower.position.set(0.118, 0.282, 0.072);
      flower.rotation.set(-0.2, 0.3, -0.35);

      const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 20, 20),
        new THREE.MeshStandardMaterial({ color: 0xffdd00, roughness: 0.3 })
      );
      flower.add(center);

      const petalMat = new THREE.MeshPhysicalMaterial({
        color: 0xff66cc,
        roughness: 0.3,
        clearcoat: 0.4,
      });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.015, 20, 18), petalMat);
        petal.scale.set(1.1, 1.1, 0.55);
        petal.position.set(Math.cos(a) * 0.024, Math.sin(a) * 0.024, 0);
        flower.add(petal);
      }
      this.accessoryGroup.add(flower);
    }
  }

  /**
   * Renders the 3D overhead billboard combining the dynamic Mood Status Header Pill
   * (driven by live `hunger` and `happiness`) with the pet's speech bubble message.
   */
  public updateSpeechBubble(force: boolean = false) {
    const text = petManager.getSpeechBubble();
    const moodInfo = petManager.getMoodInfo();
    const personalityInfo = petManager.getPersonalityInfo();
    const state = petManager.getState();
    const h = Math.round(state.hunger);
    const hap = Math.round(state.happiness);

    const signature = `${personalityInfo.personality}|${personalityInfo.ageDaysFormatted}|${moodInfo.mood}|${h}|${hap}|${text}`;
    if (!force && signature === this.lastRenderedHudSignature) {
      return;
    }
    this.lastRenderedHudSignature = signature;

    const ctx = this.speechCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, this.speechCanvas.width, this.speechCanvas.height);

    const x = 32;
    const y = 28;
    const w = this.speechCanvas.width - 64;
    const hBox = this.speechCanvas.height - 84;
    const r = 48;

    ctx.fillStyle = 'rgba(15, 20, 34, 0.92)';
    ctx.strokeStyle = personalityInfo.cssColor;
    ctx.lineWidth = 8;

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + hBox - r);
    ctx.quadraticCurveTo(x + w, y + hBox, x + w - r, y + hBox);

    // Downward tail
    ctx.lineTo(x + w / 2 + 34, y + hBox);
    ctx.lineTo(x + w / 2, y + hBox + 42);
    ctx.lineTo(x + w / 2 - 34, y + hBox);

    ctx.lineTo(x + r, y + hBox);
    ctx.quadraticCurveTo(x, y + hBox, x, y + hBox - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    // Top Personality & Mood Indicator Header Pill
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(x + 28, y + 20, w - 56, 86);

    ctx.font = 'bold 40px "Google Sans", sans-serif';
    ctx.fillStyle = personalityInfo.cssColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `${personalityInfo.iconEmoji} ${personalityInfo.label} (${personalityInfo.ageDaysFormatted})   •   ${moodInfo.iconEmoji} ${moodInfo.label}   •   🍎 ${h}%  ❤️ ${hap}%`,
      this.speechCanvas.width / 2,
      y + 64,
      w - 72
    );

    // Speech Message Text
    ctx.font = 'bold 48px "Google Sans", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, this.speechCanvas.width / 2, y + 224, w - 72);

    this.speechTexture.needsUpdate = true;
  }

  public triggerFlip() {
    this.isFlipping = true;
    this.flipTime = 0;
  }

  public spawnHearts(count: number = 6) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.025, 12, 10);
      const mat = new THREE.MeshBasicMaterial({ color: 0xff3366 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.set(1.0, 1.2, 0.5);

      mesh.position.set(
        (Math.random() - 0.5) * 0.2,
        0.2 + Math.random() * 0.1,
        (Math.random() - 0.5) * 0.2
      );

      this.particlesGroup.add(mesh);
      this.activeParticles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          0.4 + Math.random() * 0.3,
          (Math.random() - 0.5) * 0.3
        ),
        life: 0,
        maxLife: 1.2 + Math.random() * 0.6,
        rotSpeed: (Math.random() - 0.5) * 4,
      });
    }
  }

  public spawnBubbles(count: number = 8) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.02 + Math.random() * 0.02, 16, 12);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x88e5ff,
        transparent: true,
        opacity: 0.65,
        roughness: 0.1,
      });
      const mesh = new THREE.Mesh(geo, mat);

      mesh.position.set(
        (Math.random() - 0.5) * 0.3,
        0.15 + Math.random() * 0.15,
        (Math.random() - 0.5) * 0.3
      );

      this.particlesGroup.add(mesh);
      this.activeParticles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.2,
          0.3 + Math.random() * 0.25,
          (Math.random() - 0.5) * 0.2
        ),
        life: 0,
        maxLife: 1.5,
        rotSpeed: 0,
      });
    }
  }

  public spawnStars(count: number = 10) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.OctahedronGeometry(0.025);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
      const mesh = new THREE.Mesh(geo, mat);

      mesh.position.set(
        (Math.random() - 0.5) * 0.25,
        0.25 + Math.random() * 0.2,
        (Math.random() - 0.5) * 0.25
      );

      this.particlesGroup.add(mesh);
      this.activeParticles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.6,
          0.5 + Math.random() * 0.4,
          (Math.random() - 0.5) * 0.6
        ),
        life: 0,
        maxLife: 1.4,
        rotSpeed: (Math.random() - 0.5) * 6,
      });
    }
  }

  /**
   * Spawns colorful 3D food crumbs around the pet's mouth during each bite of the feeding animation.
   */
  public spawnFoodCrumbs(snackType: 'apple' | 'cake' | 'sushi' | 'cookie', count: number = 6) {
    const crumbColors: Record<'apple' | 'cake' | 'sushi' | 'cookie', number> = {
      apple: 0xe63946,
      cake: 0xff99bb,
      sushi: 0xff70a6,
      cookie: 0xd4a373,
    };
    const col = crumbColors[snackType];
    for (let i = 0; i < count; i++) {
      const geo = new THREE.DodecahedronGeometry(0.01 + Math.random() * 0.008, 0);
      const mat = new THREE.MeshBasicMaterial({ color: col });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 0.08,
        0.14 + (Math.random() - 0.5) * 0.04,
        0.19 + Math.random() * 0.04
      );
      this.particlesGroup.add(mesh);
      this.activeParticles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.45,
          0.25 + Math.random() * 0.35,
          0.12 + Math.random() * 0.25
        ),
        life: 0,
        maxLife: 0.65 + Math.random() * 0.3,
        rotSpeed: (Math.random() - 0.5) * 10,
      });
    }
  }

  /**
   * Triggers the interactive 3D Feeding Animation:
   * - Spawns a 3D `FoodObject` (`apple`, `cake`, `sushi`, or `cookie`) that arcs into the pet's mouth
   * - Animates 3 synchronized chomps with shrinking snack scale and 3D food crumb bursts
   * - Concludes with a joyful swallow bounce and heart/star particles
   */
  public triggerFeedingAnimation(snackType: 'apple' | 'cake' | 'sushi' | 'cookie' = 'apple') {
    this.clearGroup(this.feedingPropGroup);
    this.activeFoodProp = new FoodObject(snackType);
    this.activeFoodProp.xb = { pointerEvents: 'none' };
    this.activeFoodProp.position.set(0, 0.26, 0.38);
    this.feedingPropGroup.add(this.activeFoodProp);

    this.isEatingAnim = true;
    this.eatingAnimTime = 0;
    this.eatingBiteStage = 0;
    this.eatingSnackType = snackType;

    this.spawnHearts(5);
  }

  /**
   * Triggers the interactive 3D Grooming / Brushing Animation:
   * - Spawns a 3D `GroomingBrush` that glides across the pet's head and coat in 4 soothing strokes
   * - Pet blissfully closes eyes, leans into the brush strokes, and emits hearts & sparkles
   */
  public triggerGroomingAnimation() {
    this.clearGroup(this.groomingPropGroup);
    this.activeBrushProp = new GroomingBrush();
    this.activeBrushProp.xb = { pointerEvents: 'none' };
    this.activeBrushProp.position.set(-0.14, 0.34, 0.08);
    this.groomingPropGroup.add(this.activeBrushProp);

    this.isGroomingAnim = true;
    this.groomingAnimTime = 0;
    this.groomingStrokeStage = 0;

    this.spawnHearts(6);
    this.spawnStars(6);
  }

  /**
   * Updates the 3D Mood Crystal, Orbiting Rings, Contextual Satellites, Ground Aura Ring,
   * Facial Expressions (brows, mouth, cheeks), and Body Posture based on `hunger` & `happiness`.
   */
  private updateMoodVisuals(deltaTime: number, state: PetState) {
    const moodInfo = petManager.getMoodInfo();
    const personalityInfo = petManager.getPersonalityInfo();
    const mood: PetMood = moodInfo.mood;
    const personality = personalityInfo.personality;

    // 1. Smoothly interpolate 3D Mood Crystal & Ground Aura colors (blended with Personality tint)
    _targetMoodColor.setHex(personalityInfo.hexColor);
    _targetAccentColor.setHex(moodInfo.accentHex);

    const colorLerp = 1 - Math.exp(-8 * deltaTime);
    this.moodCrystalMaterial.color.lerp(_targetMoodColor, colorLerp);
    this.moodCrystalMaterial.emissive.lerp(_targetMoodColor, colorLerp);
    this.moodRingMaterial.color.lerp(_targetAccentColor, colorLerp);
    this.moodAuraRingMaterial.color.lerp(_targetMoodColor, colorLerp);
    this.moodAuraDiscMaterial.color.lerp(_targetMoodColor, colorLerp);

    // 2. Dynamic Spin & Bobbing of Overhead 3D Mood Plumbob
    const spinSpeed =
      personality === 'Playful' || mood === 'ecstatic'
        ? 4.4
        : mood === 'distressed' || personality === 'Hangry'
          ? 5.5
          : personality === 'Curious'
            ? 3.2
            : personality === 'Sleepy' || mood === 'sad'
              ? 0.85
              : 2.0;

    this.moodCrystalMesh.rotation.y += deltaTime * spinSpeed;
    this.moodOuterRingMesh.rotation.z += deltaTime * (spinSpeed * 0.8);
    this.moodInnerRingMesh.rotation.x -= deltaTime * (spinSpeed * 1.1);

    const bobOffset = Math.sin(this.animTime * (personality === 'Sleepy' ? 1.5 : 3.5)) * 0.015;
    const distressJitter =
      mood === 'distressed' ? Math.sin(this.animTime * 28) * 0.008 : 0;
    this.moodIndicatorGroup.position.set(distressJitter, 0.41 + bobOffset, 0);

    // 3. Contextual 3D Satellites for Hunger, Sadness, and Ecstatic/Playful/Wise states
    const isHungry = !state.isSleeping && state.hunger < 50;
    const isSad = !state.isSleeping && state.happiness < 50;
    const isEcstatic = mood === 'ecstatic' || personality === 'Playful' || personality === 'Wise';

    this.hungerSatelliteGroup.visible = isHungry;
    if (isHungry) {
      this.hungerSatelliteGroup.rotation.y += deltaTime * 2.6;
      const pulse = 1.0 + Math.sin(this.animTime * 8) * 0.18;
      this.hungerSatelliteGroup.children[0]?.scale.setScalar(pulse);
    }

    this.sadTearSatelliteGroup.visible = isSad;
    if (isSad) {
      this.sadTearSatelliteGroup.rotation.y -= deltaTime * 1.5;
      this.sadTearSatelliteGroup.children.forEach((tear, idx) => {
        tear.position.y = Math.sin(this.animTime * 3 + idx * Math.PI) * 0.015;
      });
    }

    this.ecstaticStarSatelliteGroup.visible = isEcstatic;
    if (isEcstatic) {
      this.ecstaticStarSatelliteGroup.rotation.y += deltaTime * 3.5;
      this.ecstaticStarSatelliteGroup.children.forEach((star, idx) => {
        star.rotation.y += deltaTime * 5;
        star.position.y = Math.sin(this.animTime * 5 + idx * 2.1) * 0.012;
      });
    }

    // 4. Grounded Mood Aura Ring Pulse
    const auraPulseSpeed =
      mood === 'distressed'
        ? 7.0
        : personality === 'Playful'
          ? 4.8
          : personality === 'Sleepy'
            ? 1.4
            : 2.5;
    const auraScale = 1.0 + Math.sin(this.animTime * auraPulseSpeed) * 0.06;
    this.moodAuraGroup.scale.setScalar(auraScale);
    this.moodAuraRingMaterial.opacity =
      mood === 'distressed'
        ? 0.55 + Math.sin(this.animTime * 10) * 0.3
        : 0.65;

    // 5. Dynamic 3D Facial Expression Morphing (Eyebrows, Pupils, Mouth, Cheeks)
    if (this.leftBrowMesh && this.rightBrowMesh) {
      let targetLeftBrowRot = 0;
      let targetRightBrowRot = 0;
      let targetLeftBrowY = 0.242;
      let targetRightBrowY = 0.242;

      if (personality === 'Curious') {
        // Asymmetric inquisitive raised eyebrow for Curious personality
        targetLeftBrowRot = 0.24;
        targetRightBrowRot = 0.08;
        targetLeftBrowY = 0.252;
        targetRightBrowY = 0.239;
      } else if (personality === 'Sleepy') {
        targetLeftBrowRot = 0.14;
        targetRightBrowRot = -0.14;
        targetLeftBrowY = 0.235;
        targetRightBrowY = 0.235;
      } else if (personality === 'Playful' || mood === 'ecstatic') {
        targetLeftBrowRot = 0.18;
        targetRightBrowRot = -0.18;
        targetLeftBrowY = 0.248;
        targetRightBrowY = 0.248;
      } else if (mood === 'sad' || mood === 'distressed') {
        targetLeftBrowRot = 0.32;
        targetRightBrowRot = -0.32;
        targetLeftBrowY = 0.236;
        targetRightBrowY = 0.236;
      } else if (mood === 'hungry' || personality === 'Hangry') {
        targetLeftBrowRot = -0.22;
        targetRightBrowRot = 0.22;
        targetLeftBrowY = 0.239;
        targetRightBrowY = 0.239;
      }

      this.leftBrowMesh.rotation.z = THREE.MathUtils.damp(
        this.leftBrowMesh.rotation.z,
        targetLeftBrowRot,
        8,
        deltaTime
      );
      this.rightBrowMesh.rotation.z = THREE.MathUtils.damp(
        this.rightBrowMesh.rotation.z,
        targetRightBrowRot,
        8,
        deltaTime
      );
      this.leftBrowMesh.position.y = THREE.MathUtils.damp(
        this.leftBrowMesh.position.y,
        targetLeftBrowY,
        8,
        deltaTime
      );
      this.rightBrowMesh.position.y = THREE.MathUtils.damp(
        this.rightBrowMesh.position.y,
        targetRightBrowY,
        8,
        deltaTime
      );
    }

    // Curious Pupil Scanning: pupils look side-to-side when Curious, or center otherwise
    if (this.leftPupilMesh && this.rightPupilMesh) {
      const scanX =
        personality === 'Curious'
          ? Math.sin(this.animTime * 2.2) * 0.0085
          : personality === 'Playful'
            ? Math.sin(this.animTime * 4.5) * 0.004
            : 0;
      const scanY =
        personality === 'Curious'
          ? Math.cos(this.animTime * 1.6) * 0.0045
          : personality === 'Sleepy'
            ? -0.004
            : 0;
      this.leftPupilMesh.position.x = THREE.MathUtils.damp(
        this.leftPupilMesh.position.x,
        scanX,
        10,
        deltaTime
      );
      this.rightPupilMesh.position.x = THREE.MathUtils.damp(
        this.rightPupilMesh.position.x,
        scanX,
        10,
        deltaTime
      );
      this.leftPupilMesh.position.y = THREE.MathUtils.damp(
        this.leftPupilMesh.position.y,
        scanY,
        10,
        deltaTime
      );
      this.rightPupilMesh.position.y = THREE.MathUtils.damp(
        this.rightPupilMesh.position.y,
        scanY,
        10,
        deltaTime
      );
    }

    if (this.mouthMesh) {
      let targetMouthY = 0.14;
      let targetScaleX = 1.0;
      let targetScaleY = 1.0;

      if (state.expression === 'eating') {
        this.mouthMesh.rotation.z = Math.PI;
        targetScaleX = 0.9 + Math.sin(this.animTime * 18) * 0.28;
        targetScaleY = 0.9 + Math.cos(this.animTime * 18) * 0.36;
      } else if (mood === 'sad' || mood === 'distressed') {
        this.mouthMesh.rotation.z = 0;
        targetMouthY = 0.128;
        targetScaleX = 0.95;
        targetScaleY = 0.85;
      } else if (mood === 'hungry' || personality === 'Hangry') {
        this.mouthMesh.rotation.z = 0;
        targetMouthY = 0.133;
        targetScaleX = 0.65;
        targetScaleY = 0.65 + Math.sin(this.animTime * 10) * 0.15;
      } else if (personality === 'Curious') {
        // Small cute "o" mouth of wonder
        this.mouthMesh.rotation.z = Math.PI;
        targetMouthY = 0.138;
        targetScaleX = 0.58;
        targetScaleY = 0.95;
      } else if (personality === 'Sleepy') {
        // Gentle yawn / soft sleepy mouth
        this.mouthMesh.rotation.z = Math.PI;
        targetMouthY = 0.137;
        targetScaleX = 0.68;
        targetScaleY = 0.55 + Math.max(0, Math.sin(this.animTime * 1.2)) * 0.45;
      } else if (personality === 'Playful' || mood === 'ecstatic') {
        this.mouthMesh.rotation.z = Math.PI;
        targetMouthY = 0.142;
        targetScaleX = 1.28;
        targetScaleY = 1.32;
      } else {
        this.mouthMesh.rotation.z = Math.PI;
        targetMouthY = 0.14;
        targetScaleX = 1.0;
        targetScaleY = 1.0;
      }

      this.mouthMesh.position.y = THREE.MathUtils.damp(
        this.mouthMesh.position.y,
        targetMouthY,
        10,
        deltaTime
      );
      this.mouthMesh.scale.x = THREE.MathUtils.damp(
        this.mouthMesh.scale.x,
        targetScaleX,
        12,
        deltaTime
      );
      this.mouthMesh.scale.y = THREE.MathUtils.damp(
        this.mouthMesh.scale.y,
        targetScaleY,
        12,
        deltaTime
      );
    }

    // Cheek blush scales smoothly with happiness
    const targetCheekOpacity = THREE.MathUtils.clamp((state.happiness - 20) / 80, 0.15, 0.85);
    this.cheekMaterial.opacity = THREE.MathUtils.damp(
      this.cheekMaterial.opacity,
      targetCheekOpacity,
      8,
      deltaTime
    );

    // 6. Tummy Rumble Animation when Hungry & Personality-Driven Head Pitch / Tilt
    if (this.bellyMesh && !this.isEatingAnim) {
      if (isHungry) {
        const rumble = Math.sin(this.animTime * 22) * 0.035;
        this.bellyMesh.scale.set(0.86 + rumble, 0.88 - rumble, 0.42 + Math.abs(rumble));
      } else {
        this.bellyMesh.scale.x = THREE.MathUtils.damp(this.bellyMesh.scale.x, 0.86, 8, deltaTime);
        this.bellyMesh.scale.y = THREE.MathUtils.damp(this.bellyMesh.scale.y, 0.88, 8, deltaTime);
        this.bellyMesh.scale.z = THREE.MathUtils.damp(this.bellyMesh.scale.z, 0.42, 8, deltaTime);
      }
    }

    const targetHeadPitch =
      personality === 'Sleepy'
        ? 0.12 + Math.sin(this.animTime * 1.6) * 0.05
        : isSad
          ? 0.14
          : personality === 'Playful' || isEcstatic
            ? -0.06
            : personality === 'Curious'
              ? -0.04
              : 0;
    const targetHeadRoll =
      personality === 'Curious'
        ? Math.sin(this.animTime * 2.1) * 0.19
        : personality === 'Playful'
          ? Math.sin(this.animTime * 4.5) * 0.09
          : 0;

    this.headGroup.rotation.x = THREE.MathUtils.damp(
      this.headGroup.rotation.x,
      targetHeadPitch,
      6,
      deltaTime
    );
    this.headGroup.rotation.z = THREE.MathUtils.damp(
      this.headGroup.rotation.z,
      targetHeadRoll,
      6,
      deltaTime
    );

    // 7. Periodic Ambient Personality & Mood Particles
    this.ambientMoodParticleTimer += deltaTime;
    if (this.ambientMoodParticleTimer >= 2.2) {
      this.ambientMoodParticleTimer = 0;
      if (personality === 'Playful' || personality === 'Wise' || mood === 'ecstatic') {
        this.spawnStars(2);
      } else if (personality === 'Affectionate') {
        this.spawnHearts(2);
      } else if (mood === 'distressed') {
        this.spawnBubbles(1);
      }
    }

    // Keep overhead billboard synced with live personality, age, hunger & happiness %
    this.updateSpeechBubble(false);
  }

  public update(deltaTime: number, camera?: THREE.Camera) {
    this.animTime += deltaTime;

    const state = petManager.getState();
    const personality = petManager.getPersonality();

    // Smoothly damp overall evolution scale
    const currentS = THREE.MathUtils.damp(this.scale.x, this.currentScaleTarget, 6, deltaTime);
    this.scale.setScalar(currentS);

    // Update 3D Visual Mood & Personality Indicator System
    this.updateMoodVisuals(deltaTime, state);

    // Idle breathing & bobbing (scales smoothly with personality & mood energy)
    const mood = petManager.getMood();
    const breathSpeed =
      state.isSleeping || personality === 'Sleepy'
        ? 1.45
        : personality === 'Playful' || mood === 'ecstatic'
          ? 4.2
          : personality === 'Wise'
            ? 2.1
            : mood === 'sad'
              ? 2.0
              : 2.8;
    const breathAmount =
      state.isSleeping || personality === 'Sleepy'
        ? 0.026
        : personality === 'Playful' || mood === 'ecstatic'
          ? 0.056
          : 0.038;
    const breath = Math.sin(this.animTime * breathSpeed);

    const targetHeadScaleY = 1.0 + breath * breathAmount;
    const targetHeadScaleXZ = 1.0 - breath * (breathAmount * 0.48);
    this.headGroup.scale.y = THREE.MathUtils.damp(this.headGroup.scale.y, targetHeadScaleY, 12, deltaTime);
    this.headGroup.scale.x = THREE.MathUtils.damp(this.headGroup.scale.x, targetHeadScaleXZ, 12, deltaTime);
    this.headGroup.scale.z = THREE.MathUtils.damp(this.headGroup.scale.z, targetHeadScaleXZ, 12, deltaTime);

    // Cute Chubby Arm Wave & Breathing Follow-Through
    if (this.leftArmMesh && this.rightArmMesh) {
      const armWaveSpeed =
        state.isSleeping || personality === 'Sleepy'
          ? 1.2
          : personality === 'Playful' || mood === 'ecstatic'
            ? 7.8
            : personality === 'Curious'
              ? 4.4
              : 3.2;
      const armWaveAmp =
        personality === 'Playful' || mood === 'ecstatic'
          ? 0.3
          : personality === 'Sleepy'
            ? 0.05
            : 0.12;
      const armWave = Math.sin(this.animTime * armWaveSpeed) * armWaveAmp;
      const targetLeftZ = 0.52 + armWave;
      const targetRightZ = -0.52 - armWave;
      this.leftArmMesh.rotation.z = THREE.MathUtils.damp(this.leftArmMesh.rotation.z, targetLeftZ, 10, deltaTime);
      this.rightArmMesh.rotation.z = THREE.MathUtils.damp(this.rightArmMesh.rotation.z, targetRightZ, 10, deltaTime);
    }

    // Ear wobbly damping & droop when sad/sleepy or perked when curious
    if (this.earsGroup.children.length > 0) {
      const earWobble = Math.sin(this.animTime * (breathSpeed * 1.4)) * 0.07;
      const earDroop =
        state.happiness < 45 || personality === 'Sleepy'
          ? 0.24
          : personality === 'Curious'
            ? -0.08
            : 0;
      this.earsGroup.children.forEach((ear, idx) => {
        const side = idx % 2 === 0 ? 1 : -1;
        ear.rotation.x = THREE.MathUtils.damp(ear.rotation.x, -0.08 + earWobble * side, 10, deltaTime);
        if (this.earsGroup.children.length === 2) {
          ear.rotation.z = THREE.MathUtils.damp(ear.rotation.z, side * (0.26 + earDroop), 8, deltaTime);
        }
      });
    }

    // Wing flapping
    if (this.wingsGroup.children.length > 0) {
      const flapSpeed =
        state.isSleeping || personality === 'Sleepy'
          ? 1.0
          : personality === 'Playful' || mood === 'ecstatic'
            ? 10.5
            : mood === 'sad'
              ? 3.5
              : 7.5;
      const wingFlap = Math.sin(this.animTime * flapSpeed) * 0.32;
      if (this.wingsGroup.children[0]) {
        this.wingsGroup.children[0].rotation.y = wingFlap;
      }
      if (this.wingsGroup.children[1]) {
        this.wingsGroup.children[1].rotation.y = -wingFlap;
      }
    }

    // Tail wagging speed scales with happiness & Playful personality
    if (this.tailGroup.children.length > 0) {
      const wagSpeed =
        (personality === 'Playful' ? 3.5 : 1.5) + (state.happiness / 100) * 5.5;
      const tailWag = Math.sin(this.animTime * wagSpeed) * 0.22;
      this.tailGroup.children.forEach((t) => {
        t.rotation.y = tailWag;
      });
    }

    // Smooth Blinking & Personality-Aware Eye Openness Damping
    this.blinkTimer -= deltaTime;
    if (this.blinkTimer <= 0) {
      this.isBlinking = true;
      this.blinkProgress = 0;
      this.blinkTimer =
        personality === 'Sleepy' ? 1.4 + Math.random() * 1.8 : 2.5 + Math.random() * 3.5;
    }

    if (this.isBlinking) {
      this.blinkProgress += deltaTime * 11;
      const eyeScaleY = Math.max(0.08, Math.abs(Math.cos(this.blinkProgress * Math.PI)));
      if (this.leftEyeMesh && this.rightEyeMesh) {
        this.leftEyeMesh.scale.y = eyeScaleY * 1.15;
        this.rightEyeMesh.scale.y = eyeScaleY * 1.15;
      }
      if (this.blinkProgress >= 1.0) {
        this.isBlinking = false;
      }
    } else if (this.leftEyeMesh && this.rightEyeMesh) {
      const targetEyeY = state.isSleeping
        ? 0.12
        : this.isGroomingAnim
          ? 0.16
          : personality === 'Sleepy'
            ? 0.45
            : mood === 'sad' || mood === 'distressed'
              ? 0.84
              : personality === 'Curious' || personality === 'Playful' || mood === 'ecstatic'
                ? 1.25
                : 1.15;
      this.leftEyeMesh.scale.y = THREE.MathUtils.damp(this.leftEyeMesh.scale.y, targetEyeY, 12, deltaTime);
      this.rightEyeMesh.scale.y = THREE.MathUtils.damp(this.rightEyeMesh.scale.y, targetEyeY, 12, deltaTime);
    }

    // 3D Multi-Stage Feeding Animation (Food flight -> 3 Chomps + Crumb Bursts -> Happy Hop)
    if (this.isEatingAnim) {
      this.eatingAnimTime += deltaTime;
      const t = this.eatingAnimTime;

      if (t < 0.32) {
        const p = t / 0.32;
        if (this.activeFoodProp) {
          this.activeFoodProp.position.set(
            0,
            0.26 - p * 0.115 + Math.sin(p * Math.PI) * 0.08,
            0.38 - p * 0.175
          );
          this.activeFoodProp.rotation.y += deltaTime * 8;
        }
        this.bodyGroup.rotation.x = THREE.MathUtils.damp(this.bodyGroup.rotation.x, p * 0.18, 14, deltaTime);
      } else if (t < 1.42) {
        if (this.activeFoodProp) {
          this.activeFoodProp.position.set(0, 0.145, 0.205);
          this.activeFoodProp.rotation.y += deltaTime * 5;
        }

        if (this.eatingBiteStage === 0 && t >= 0.35) {
          this.eatingBiteStage = 1;
          this.activeFoodProp?.scale.setScalar(0.75);
          this.spawnFoodCrumbs(this.eatingSnackType, 6);
        } else if (this.eatingBiteStage === 1 && t >= 0.72) {
          this.eatingBiteStage = 2;
          this.activeFoodProp?.scale.setScalar(0.45);
          this.spawnFoodCrumbs(this.eatingSnackType, 6);
        } else if (this.eatingBiteStage === 2 && t >= 1.08) {
          this.eatingBiteStage = 3;
          this.activeFoodProp?.scale.setScalar(0.18);
          this.spawnFoodCrumbs(this.eatingSnackType, 7);
        }

        const chompWave = Math.sin((t - 0.32) * 24);
        this.bodyGroup.rotation.x = 0.1 + chompWave * 0.11;
        this.bodyGroup.position.y = Math.abs(chompWave) * 0.036;
        if (this.bellyMesh) {
          const swell = 1.0 + ((t - 0.32) / 1.1) * 0.12;
          this.bellyMesh.scale.set(0.86 * swell, 0.88 * swell, 0.42 * swell);
        }
      } else if (t < 1.8) {
        if (this.activeFoodProp) {
          this.clearGroup(this.feedingPropGroup);
          this.activeFoodProp = undefined;
          this.spawnStars(6);
          this.spawnHearts(4);
        }
        const hopProgress = (t - 1.42) / 0.38;
        this.bodyGroup.rotation.x = THREE.MathUtils.damp(this.bodyGroup.rotation.x, 0, 12, deltaTime);
        this.bodyGroup.position.y = Math.sin(hopProgress * Math.PI) * 0.13;
      } else {
        this.isEatingAnim = false;
        this.clearGroup(this.feedingPropGroup);
        this.activeFoodProp = undefined;
      }
    }

    // 3D Soothing Grooming / Brushing Animation (4 rhythmic brush strokes across head & coat)
    if (this.isGroomingAnim) {
      this.groomingAnimTime += deltaTime;
      const t = this.groomingAnimTime;

      if (t < 1.68) {
        const strokeWave = Math.sin(t * ((Math.PI * 4) / 1.68));
        const strokeArc = Math.cos(t * ((Math.PI * 4) / 1.68));

        if (this.activeBrushProp) {
          this.activeBrushProp.position.set(
            strokeWave * 0.14,
            0.33 + Math.abs(strokeArc) * 0.045,
            0.06 + strokeArc * 0.05
          );
          this.activeBrushProp.rotation.set(
            0.35 + strokeArc * 0.18,
            -strokeWave * 0.3,
            -strokeWave * 0.45
          );
        }

        this.bodyGroup.rotation.z = strokeWave * 0.11;
        this.bodyGroup.position.y = Math.abs(strokeWave) * 0.022;

        const currentStroke = Math.floor(t / 0.4);
        if (currentStroke > this.groomingStrokeStage) {
          this.groomingStrokeStage = currentStroke;
          this.spawnStars(3);
          this.spawnHearts(2);
        }
      } else {
        this.isGroomingAnim = false;
        this.clearGroup(this.groomingPropGroup);
        this.activeBrushProp = undefined;
      }
    }

    // Joyful flip animation
    if (this.isFlipping) {
      this.flipTime += deltaTime * 3.5;
      this.bodyGroup.rotation.x = this.flipTime * Math.PI * 2;
      this.bodyGroup.position.y = Math.sin(this.flipTime * Math.PI) * 0.25;

      if (this.flipTime >= 1.0) {
        this.isFlipping = false;
        this.bodyGroup.rotation.x = 0;
        this.bodyGroup.position.y = 0;
      }
    } else if (!this.isEatingAnim && !this.isGroomingAnim) {
      // Smoothly damp bodyGroup back to neutral pose when idle
      this.bodyGroup.rotation.x = THREE.MathUtils.damp(this.bodyGroup.rotation.x, 0, 10, deltaTime);
      this.bodyGroup.rotation.z = THREE.MathUtils.damp(this.bodyGroup.rotation.z, 0, 10, deltaTime);
      this.bodyGroup.position.y = THREE.MathUtils.damp(this.bodyGroup.position.y, 0, 10, deltaTime);
    }

    // Billboard the speech & mood HUD towards camera
    if (camera) {
      this.speechMesh.quaternion.copy(camera.quaternion);
    }

    // Update particles
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life += deltaTime;
      p.mesh.position.addScaledVector(p.velocity, deltaTime);
      p.mesh.rotation.y += p.rotSpeed * deltaTime;
      const progress = p.life / p.maxLife;
      p.mesh.scale.setScalar(Math.max(0.001, (1.0 - progress) * 1.2));

      if (p.life >= p.maxLife) {
        this.particlesGroup.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.activeParticles.splice(i, 1);
      }
    }
  }

  public dispose() {
    this.speechCanvas.remove();
    this.speechTexture.dispose();
    this.bodyMaterial.dispose();
    this.secondaryMaterial.dispose();
    this.eyeMaterial.dispose();
    this.pupilMaterial.dispose();
    this.cheekMaterial.dispose();
    this.goldMaterial.dispose();
    this.moodCrystalMaterial.dispose();
    this.moodRingMaterial.dispose();
    this.moodAuraRingMaterial.dispose();
    this.moodAuraDiscMaterial.dispose();
  }
}
