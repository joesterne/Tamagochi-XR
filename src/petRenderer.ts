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

  // Materials
  private bodyMaterial: THREE.MeshStandardMaterial;
  private secondaryMaterial: THREE.MeshStandardMaterial;
  private eyeMaterial: THREE.MeshBasicMaterial;
  private pupilMaterial: THREE.MeshBasicMaterial;
  private cheekMaterial: THREE.MeshBasicMaterial;
  private goldMaterial: THREE.MeshStandardMaterial;

  // Body & Face meshes for dynamic mood posture & expressions
  private bellyMesh?: THREE.Mesh;
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

    // Standard materials
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xff85a2,
      roughness: 0.35,
      metalness: 0.1,
    });
    this.secondaryMaterial = new THREE.MeshStandardMaterial({
      color: 0xffb3c6,
      roughness: 0.4,
      metalness: 0.05,
    });
    this.eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x1a1a2e });
    this.cheekMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4d79,
      transparent: true,
      opacity: 0.7,
    });
    this.goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      metalness: 0.8,
      roughness: 0.2,
    });

    // Mood Indicator Materials
    this.moodCrystalMaterial = new THREE.MeshStandardMaterial({
      color: 0x00f5d4,
      emissive: 0x00f5d4,
      emissiveIntensity: 0.55,
      roughness: 0.15,
      metalness: 0.3,
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

    // Speech & Mood HUD 2D canvas billboard
    this.speechCanvas = document.createElement('canvas');
    this.speechCanvas.width = 640;
    this.speechCanvas.height = 220;
    this.speechTexture = new THREE.CanvasTexture(this.speechCanvas);
    this.speechTexture.colorSpace = THREE.SRGBColorSpace;

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

    // 6. Grounded 3D Mood Aura Ring beneath the pet's feet
    this.moodAuraGroup.position.set(0, 0.005, 0);
    this.moodAuraGroup.xb = { pointerEvents: 'none' };

    const auraRingGeo = new THREE.RingGeometry(0.19, 0.23, 48);
    auraRingGeo.rotateX(-Math.PI / 2);
    this.moodAuraRingMesh = new THREE.Mesh(auraRingGeo, this.moodAuraRingMaterial);

    const auraDiscGeo = new THREE.CircleGeometry(0.19, 48);
    auraDiscGeo.rotateX(-Math.PI / 2);
    this.moodAuraDiscMesh = new THREE.Mesh(auraDiscGeo, this.moodAuraDiscMaterial);

    this.moodAuraGroup.add(this.moodAuraRingMesh, this.moodAuraDiscMesh);
  }

  public rebuildModel(state: PetState) {
    // Clear dynamic groups
    this.clearGroup(this.headGroup);
    this.clearGroup(this.faceGroup);
    this.clearGroup(this.earsGroup);
    this.clearGroup(this.wingsGroup);
    this.clearGroup(this.tailGroup);
    this.clearGroup(this.hornsGroup);
    this.clearGroup(this.accessoryGroup);

    // Update colors
    const colorDef = PET_COLORS[state.colorId] || PET_COLORS.pink;
    this.bodyMaterial.color.setHex(colorDef.primary);
    this.secondaryMaterial.color.setHex(colorDef.secondary);
    this.cheekMaterial.color.setHex(colorDef.accent);

    // Calculate scale by evolution stage
    const stageScales: Record<string, number> = {
      baby: 0.75,
      child: 0.95,
      teen: 1.15,
      adult: 1.35,
      mystic: 1.55,
    };
    this.currentScaleTarget = stageScales[state.stage] || 1.0;
    this.scale.setScalar(this.currentScaleTarget);

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

  private buildBaseBody(species: PetSpecies) {
    let bodyGeo: THREE.BufferGeometry;
    if (species === 'blobby') {
      bodyGeo = new THREE.SphereGeometry(0.18, 32, 24);
    } else if (species === 'pipsqueak') {
      bodyGeo = new THREE.SphereGeometry(0.16, 32, 24);
    } else if (species === 'draco') {
      bodyGeo = new THREE.SphereGeometry(0.17, 32, 24);
    } else {
      bodyGeo = new THREE.SphereGeometry(0.17, 32, 24);
    }

    const mainBody = new THREE.Mesh(bodyGeo, this.bodyMaterial);
    mainBody.position.set(0, 0.16, 0);
    mainBody.scale.set(1.0, 0.95, 0.95);
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    this.headGroup.add(mainBody);

    // Chubby Belly patch (secondary material - animates tummy rumble when hungry)
    const bellyGeo = new THREE.SphereGeometry(0.13, 24, 16);
    this.bellyMesh = new THREE.Mesh(bellyGeo, this.secondaryMaterial);
    this.bellyMesh.position.set(0, 0.14, 0.08);
    this.bellyMesh.scale.set(0.85, 0.9, 0.4);
    this.headGroup.add(this.bellyMesh);

    // Cute chubby feet/paws
    const footGeo = new THREE.SphereGeometry(0.045, 16, 12);
    const leftFoot = new THREE.Mesh(footGeo, this.secondaryMaterial);
    leftFoot.position.set(-0.08, 0.03, 0.05);
    leftFoot.scale.set(1, 0.6, 1.4);
    const rightFoot = leftFoot.clone();
    rightFoot.position.x = 0.08;
    this.headGroup.add(leftFoot, rightFoot);
  }

  private buildFace() {
    // Eyes: 2 glossy spheres
    const eyeGeo = new THREE.SphereGeometry(0.038, 20, 16);
    this.leftEyeMesh = new THREE.Mesh(eyeGeo, this.eyeMaterial);
    this.leftEyeMesh.position.set(-0.065, 0.19, 0.14);
    this.leftEyeMesh.scale.set(1, 1.15, 0.5);

    this.rightEyeMesh = new THREE.Mesh(eyeGeo, this.eyeMaterial);
    this.rightEyeMesh.position.set(0.065, 0.19, 0.14);
    this.rightEyeMesh.scale.set(1, 1.15, 0.5);

    // Pupils
    const pupilGeo = new THREE.SphereGeometry(0.024, 16, 12);
    this.leftPupilMesh = new THREE.Mesh(pupilGeo, this.pupilMaterial);
    this.leftPupilMesh.position.set(0, 0, 0.02);
    this.leftEyeMesh.add(this.leftPupilMesh);

    this.rightPupilMesh = new THREE.Mesh(pupilGeo, this.pupilMaterial);
    this.rightPupilMesh.position.set(0, 0, 0.02);
    this.rightEyeMesh.add(this.rightPupilMesh);

    // Specular eye shine dots
    const shineGeo = new THREE.SphereGeometry(0.009, 10, 8);
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const shine1 = new THREE.Mesh(shineGeo, shineMat);
    shine1.position.set(0.008, 0.008, 0.02);
    this.leftPupilMesh.add(shine1);
    const shine2 = shine1.clone();
    this.rightPupilMesh.add(shine2);

    // Expressive 3D Eyebrows (dynamically tilt with mood)
    const browGeo = new THREE.BoxGeometry(0.042, 0.009, 0.01);
    const browMat = new THREE.MeshBasicMaterial({ color: 0x22182b });
    this.leftBrowMesh = new THREE.Mesh(browGeo, browMat);
    this.leftBrowMesh.position.set(-0.065, 0.242, 0.145);
    this.rightBrowMesh = new THREE.Mesh(browGeo, browMat);
    this.rightBrowMesh.position.set(0.065, 0.242, 0.145);

    // Cheeks
    const cheekGeo = new THREE.SphereGeometry(0.028, 16, 10);
    this.leftCheek = new THREE.Mesh(cheekGeo, this.cheekMaterial);
    this.leftCheek.position.set(-0.11, 0.145, 0.125);
    this.leftCheek.scale.set(1, 0.5, 0.3);

    this.rightCheek = new THREE.Mesh(cheekGeo, this.cheekMaterial);
    this.rightCheek.position.set(0.11, 0.145, 0.125);
    this.rightCheek.scale.set(1, 0.5, 0.3);

    // Mouth: curved torus arc that flips between smile, hungry 'o', and sad frown
    const mouthGeo = new THREE.TorusGeometry(0.018, 0.004, 8, 16, Math.PI);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x331122 });
    this.mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
    this.mouthMesh.rotation.z = Math.PI;
    this.mouthMesh.position.set(0, 0.14, 0.158);

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
      const earGeo = new THREE.ConeGeometry(0.045, 0.14, 16);
      const leftEar = new THREE.Mesh(earGeo, this.bodyMaterial);
      leftEar.position.set(-0.08, 0.32, -0.02);
      leftEar.rotation.z = 0.25;
      leftEar.rotation.x = -0.1;

      const rightEar = new THREE.Mesh(earGeo, this.bodyMaterial);
      rightEar.position.set(0.08, 0.32, -0.02);
      rightEar.rotation.z = -0.25;
      rightEar.rotation.x = -0.1;

      const innerEarGeo = new THREE.ConeGeometry(0.028, 0.1, 16);
      const innerLeft = new THREE.Mesh(innerEarGeo, this.secondaryMaterial);
      innerLeft.position.set(0, -0.01, 0.015);
      leftEar.add(innerLeft);

      const innerRight = new THREE.Mesh(innerEarGeo, this.secondaryMaterial);
      innerRight.position.set(0, -0.01, 0.015);
      rightEar.add(innerRight);

      this.earsGroup.add(leftEar, rightEar);
    } else if (species === 'pipsqueak') {
      const beakGeo = new THREE.ConeGeometry(0.03, 0.05, 12);
      const beakMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.3 });
      const beak = new THREE.Mesh(beakGeo, beakMat);
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.165, 0.165);
      this.faceGroup.add(beak);

      const crestGeo = new THREE.ConeGeometry(0.035, 0.09, 10);
      const crest = new THREE.Mesh(crestGeo, this.secondaryMaterial);
      crest.position.set(0, 0.31, 0.02);
      crest.rotation.x = -0.3;
      this.earsGroup.add(crest);

      const wingGeo = new THREE.BoxGeometry(0.03, 0.08, 0.12);
      const leftWing = new THREE.Mesh(wingGeo, this.bodyMaterial);
      leftWing.position.set(-0.16, 0.16, 0);
      leftWing.rotation.z = -0.3;

      const rightWing = new THREE.Mesh(wingGeo, this.bodyMaterial);
      rightWing.position.set(0.16, 0.16, 0);
      rightWing.rotation.z = 0.3;

      this.wingsGroup.add(leftWing, rightWing);
    } else if (species === 'draco') {
      const hornGeo = new THREE.ConeGeometry(0.032, 0.11, 12);
      const hornMat = this.goldMaterial;
      const leftHorn = new THREE.Mesh(hornGeo, hornMat);
      leftHorn.position.set(-0.08, 0.31, -0.04);
      leftHorn.rotation.z = 0.35;
      leftHorn.rotation.x = -0.3;

      const rightHorn = new THREE.Mesh(hornGeo, hornMat);
      rightHorn.position.set(0.08, 0.31, -0.04);
      rightHorn.rotation.z = -0.35;
      rightHorn.rotation.x = -0.3;

      this.hornsGroup.add(leftHorn, rightHorn);

      const wingShape = new THREE.ConeGeometry(0.07, 0.16, 4);
      const leftWing = new THREE.Mesh(wingShape, this.secondaryMaterial);
      leftWing.position.set(-0.16, 0.2, -0.08);
      leftWing.rotation.set(0.5, -0.3, 1.2);

      const rightWing = new THREE.Mesh(wingShape, this.secondaryMaterial);
      rightWing.position.set(0.16, 0.2, -0.08);
      rightWing.rotation.set(0.5, 0.3, -1.2);

      this.wingsGroup.add(leftWing, rightWing);

      const tailGeo = new THREE.CylinderGeometry(0.015, 0.04, 0.16, 12);
      const tail = new THREE.Mesh(tailGeo, this.bodyMaterial);
      tail.position.set(0, 0.09, -0.16);
      tail.rotation.x = -Math.PI / 3;

      const tipGeo = new THREE.ConeGeometry(0.04, 0.06, 4);
      const tip = new THREE.Mesh(tipGeo, this.goldMaterial);
      tip.position.set(0, -0.09, 0);
      tip.rotation.x = Math.PI;
      tail.add(tip);

      this.tailGroup.add(tail);
    } else if (species === 'kitsune') {
      const earGeo = new THREE.ConeGeometry(0.05, 0.13, 12);
      const leftEar = new THREE.Mesh(earGeo, this.bodyMaterial);
      leftEar.position.set(-0.09, 0.31, -0.01);
      leftEar.rotation.z = 0.3;

      const rightEar = new THREE.Mesh(earGeo, this.bodyMaterial);
      rightEar.position.set(0.09, 0.31, -0.01);
      rightEar.rotation.z = -0.3;

      const innerEarGeo = new THREE.ConeGeometry(0.03, 0.09, 12);
      const innerLeft = new THREE.Mesh(innerEarGeo, this.secondaryMaterial);
      innerLeft.position.set(0, -0.01, 0.015);
      leftEar.add(innerLeft);

      const innerRight = new THREE.Mesh(innerEarGeo, this.secondaryMaterial);
      innerRight.position.set(0, -0.01, 0.015);
      rightEar.add(innerRight);

      this.earsGroup.add(leftEar, rightEar);

      const jewelGeo = new THREE.OctahedronGeometry(0.025);
      const jewelMat = new THREE.MeshStandardMaterial({
        color: 0x00f5d4,
        emissive: 0x00f5d4,
        emissiveIntensity: 0.6,
        roughness: 0.1,
      });
      const jewel = new THREE.Mesh(jewelGeo, jewelMat);
      jewel.position.set(0, 0.25, 0.155);
      this.faceGroup.add(jewel);

      for (let i = -1; i <= 1; i += 2) {
        const tailGeo = new THREE.ConeGeometry(0.05, 0.22, 16);
        const tail = new THREE.Mesh(tailGeo, this.secondaryMaterial);
        tail.position.set(i * 0.07, 0.12, -0.18);
        tail.rotation.set(-1.1, i * 0.25, 0);
        this.tailGroup.add(tail);
      }
    }
  }

  private buildAccessory(accessory: PetAccessory) {
    if (accessory === 'none') return;

    if (accessory === 'crown') {
      const crown = new THREE.Group();
      crown.position.set(0, 0.31, 0.02);

      const baseRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.065, 0.02, 24, 1, true),
        this.goldMaterial
      );
      crown.add(baseRing);

      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.04, 8), this.goldMaterial);
        spike.position.set(Math.cos(angle) * 0.065, 0.025, Math.sin(angle) * 0.065);
        crown.add(spike);

        const gem = new THREE.Mesh(
          new THREE.SphereGeometry(0.009, 8, 8),
          new THREE.MeshStandardMaterial({
            color: i % 2 === 0 ? 0xff0055 : 0x00ddff,
            emissive: 0x330011,
            roughness: 0.2,
          })
        );
        gem.position.set(Math.cos(angle) * 0.065, 0.048, Math.sin(angle) * 0.065);
        crown.add(gem);
      }
      this.accessoryGroup.add(crown);
    } else if (accessory === 'wizard') {
      const wizardHat = new THREE.Group();
      wizardHat.position.set(0, 0.31, 0);
      wizardHat.rotation.z = -0.15;
      wizardHat.rotation.x = -0.1;

      const hatMat = new THREE.MeshStandardMaterial({ color: 0x4a154b, roughness: 0.6 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.015, 24), hatMat);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 24), hatMat);
      cone.position.y = 0.11;

      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.025), this.goldMaterial);
      star.position.set(0, 0.09, 0.065);

      wizardHat.add(brim, cone, star);
      this.accessoryGroup.add(wizardHat);
    } else if (accessory === 'sunglasses') {
      const glasses = new THREE.Group();
      glasses.position.set(0, 0.185, 0.165);

      const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
      const lensMat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0.1,
        metalness: 0.9,
      });

      const leftLens = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.038, 0.01), lensMat);
      leftLens.position.x = -0.06;
      const rightLens = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.038, 0.01), lensMat);
      rightLens.position.x = 0.06;

      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.01), frameMat);
      glasses.add(leftLens, rightLens, bridge);
      this.accessoryGroup.add(glasses);
    } else if (accessory === 'wings') {
      const angelWings = new THREE.Group();
      angelWings.position.set(0, 0.18, -0.14);

      const wingMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xddffff,
        emissiveIntensity: 0.4,
        roughness: 0.3,
      });

      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const feather = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.15, 12), wingMat);
          feather.position.set(side * (0.07 + i * 0.04), i * 0.03, -i * 0.02);
          feather.rotation.set(0.4, side * 0.3, side * (0.8 + i * 0.2));
          angelWings.add(feather);
        }
      }
      this.accessoryGroup.add(angelWings);
    } else if (accessory === 'bowtie') {
      const bowtie = new THREE.Group();
      bowtie.position.set(0, 0.09, 0.165);

      const bowMat = new THREE.MeshStandardMaterial({ color: 0xd90429, roughness: 0.4 });
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 12), bowMat);
      const leftWing = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 12), bowMat);
      leftWing.rotation.z = Math.PI / 2;
      leftWing.position.x = -0.03;
      const rightWing = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 12), bowMat);
      rightWing.rotation.z = -Math.PI / 2;
      rightWing.position.x = 0.03;

      bowtie.add(knot, leftWing, rightWing);
      this.accessoryGroup.add(bowtie);
    } else if (accessory === 'flower') {
      const flower = new THREE.Group();
      flower.position.set(0.12, 0.28, 0.07);

      const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xffdd00 })
      );
      flower.add(center);

      const petalMat = new THREE.MeshBasicMaterial({ color: 0xff66cc });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 10), petalMat);
        petal.position.set(Math.cos(a) * 0.025, Math.sin(a) * 0.025, 0);
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
    const state = petManager.getState();
    const h = Math.round(state.hunger);
    const hap = Math.round(state.happiness);

    const signature = `${moodInfo.mood}|${h}|${hap}|${text}`;
    if (!force && signature === this.lastRenderedHudSignature) {
      return;
    }
    this.lastRenderedHudSignature = signature;

    const ctx = this.speechCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, this.speechCanvas.width, this.speechCanvas.height);

    const x = 16;
    const y = 14;
    const w = this.speechCanvas.width - 32;
    const hBox = this.speechCanvas.height - 42;
    const r = 24;

    ctx.fillStyle = 'rgba(15, 20, 34, 0.90)';
    ctx.strokeStyle = moodInfo.cssColor;
    ctx.lineWidth = 5;

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + hBox - r);
    ctx.quadraticCurveTo(x + w, y + hBox, x + w - r, y + hBox);

    // Downward tail
    ctx.lineTo(x + w / 2 + 18, y + hBox);
    ctx.lineTo(x + w / 2, y + hBox + 22);
    ctx.lineTo(x + w / 2 - 18, y + hBox);

    ctx.lineTo(x + r, y + hBox);
    ctx.quadraticCurveTo(x, y + hBox, x, y + hBox - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    // Top Mood Indicator Header Pill
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(x + 14, y + 10, w - 28, 44);

    ctx.font = 'bold 23px "Google Sans", sans-serif';
    ctx.fillStyle = moodInfo.cssColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `${moodInfo.iconEmoji} MOOD: ${moodInfo.label}   •   🍎 Hunger ${h}%   •   ❤️ Happy ${hap}%`,
      this.speechCanvas.width / 2,
      y + 32
    );

    // Speech Message Text
    ctx.font = 'bold 25px "Google Sans", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, this.speechCanvas.width / 2, y + 112, w - 36);

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
    const mood: PetMood = moodInfo.mood;

    // 1. Smoothly interpolate 3D Mood Crystal & Ground Aura colors
    _targetMoodColor.setHex(moodInfo.hexColor);
    _targetAccentColor.setHex(moodInfo.accentHex);

    const colorLerp = 1 - Math.exp(-8 * deltaTime);
    this.moodCrystalMaterial.color.lerp(_targetMoodColor, colorLerp);
    this.moodCrystalMaterial.emissive.lerp(_targetMoodColor, colorLerp);
    this.moodRingMaterial.color.lerp(_targetAccentColor, colorLerp);
    this.moodAuraRingMaterial.color.lerp(_targetMoodColor, colorLerp);
    this.moodAuraDiscMaterial.color.lerp(_targetMoodColor, colorLerp);

    // 2. Dynamic Spin & Bobbing of Overhead 3D Mood Plumbob
    const spinSpeed =
      mood === 'ecstatic'
        ? 4.2
        : mood === 'distressed'
          ? 5.5
          : mood === 'hungry'
            ? 2.8
            : mood === 'sad'
              ? 0.9
              : 2.0;

    this.moodCrystalMesh.rotation.y += deltaTime * spinSpeed;
    this.moodOuterRingMesh.rotation.z += deltaTime * (spinSpeed * 0.8);
    this.moodInnerRingMesh.rotation.x -= deltaTime * (spinSpeed * 1.1);

    const bobOffset = Math.sin(this.animTime * (mood === 'sad' ? 1.8 : 3.5)) * 0.015;
    const distressJitter =
      mood === 'distressed' ? Math.sin(this.animTime * 28) * 0.008 : 0;
    this.moodIndicatorGroup.position.set(distressJitter, 0.41 + bobOffset, 0);

    // 3. Contextual 3D Satellites for Hunger, Sadness, and Ecstatic states
    const isHungry = !state.isSleeping && state.hunger < 50;
    const isSad = !state.isSleeping && state.happiness < 50;
    const isEcstatic = mood === 'ecstatic';

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
    const auraPulseSpeed = mood === 'distressed' ? 7.0 : mood === 'ecstatic' ? 4.5 : 2.5;
    const auraScale = 1.0 + Math.sin(this.animTime * auraPulseSpeed) * 0.06;
    this.moodAuraGroup.scale.setScalar(auraScale);
    this.moodAuraRingMaterial.opacity =
      mood === 'distressed'
        ? 0.55 + Math.sin(this.animTime * 10) * 0.3
        : 0.65;

    // 5. Dynamic 3D Facial Expression Morphing (Eyebrows, Mouth, Cheeks)
    if (this.leftBrowMesh && this.rightBrowMesh) {
      let targetLeftBrowRot = 0;
      let targetRightBrowRot = 0;
      let targetBrowY = 0.242;

      if (mood === 'ecstatic') {
        targetLeftBrowRot = 0.18;
        targetRightBrowRot = -0.18;
        targetBrowY = 0.248;
      } else if (mood === 'sad' || mood === 'distressed') {
        targetLeftBrowRot = 0.32;
        targetRightBrowRot = -0.32;
        targetBrowY = 0.236;
      } else if (mood === 'hungry') {
        targetLeftBrowRot = 0.22;
        targetRightBrowRot = -0.22;
        targetBrowY = 0.239;
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
        targetBrowY,
        8,
        deltaTime
      );
      this.rightBrowMesh.position.y = this.leftBrowMesh.position.y;
    }

    if (this.mouthMesh) {
      if (state.expression === 'eating') {
        // Chewing animation
        this.mouthMesh.rotation.z = Math.PI;
        this.mouthMesh.scale.set(
          0.9 + Math.sin(this.animTime * 18) * 0.3,
          0.9 + Math.cos(this.animTime * 18) * 0.4,
          1
        );
      } else if (mood === 'sad' || mood === 'distressed') {
        // Downturned frown
        this.mouthMesh.rotation.z = 0;
        this.mouthMesh.position.y = 0.128;
        this.mouthMesh.scale.set(0.95, 0.85, 1);
      } else if (mood === 'hungry') {
        // Small craving 'o' mouth
        this.mouthMesh.rotation.z = 0;
        this.mouthMesh.position.y = 0.133;
        const rumblePulse = 0.65 + Math.sin(this.animTime * 10) * 0.15;
        this.mouthMesh.scale.set(0.65, rumblePulse, 1);
      } else if (mood === 'ecstatic') {
        // Big wide joyful grin
        this.mouthMesh.rotation.z = Math.PI;
        this.mouthMesh.position.y = 0.142;
        this.mouthMesh.scale.set(1.3, 1.35, 1);
      } else {
        // Content smile
        this.mouthMesh.rotation.z = Math.PI;
        this.mouthMesh.position.y = 0.14;
        this.mouthMesh.scale.set(1, 1, 1);
      }
    }

    // Cheek blush scales with happiness
    this.cheekMaterial.opacity = THREE.MathUtils.clamp((state.happiness - 20) / 80, 0.15, 0.85);

    // 6. Tummy Rumble Animation when Hungry & Head Droop when Sad
    if (this.bellyMesh) {
      if (isHungry) {
        const rumble = Math.sin(this.animTime * 22) * 0.04;
        this.bellyMesh.scale.set(0.85 + rumble, 0.9 - rumble, 0.4 + Math.abs(rumble));
      } else {
        this.bellyMesh.scale.set(0.85, 0.9, 0.4);
      }
    }

    const targetHeadPitch = isSad ? 0.14 : isEcstatic ? -0.06 : 0;
    this.headGroup.rotation.x = THREE.MathUtils.damp(
      this.headGroup.rotation.x,
      targetHeadPitch,
      6,
      deltaTime
    );

    // 7. Periodic Ambient Mood Particles (Sparkles when Ecstatic, Sweat/Tear drop when Distressed)
    this.ambientMoodParticleTimer += deltaTime;
    if (this.ambientMoodParticleTimer >= 2.2) {
      this.ambientMoodParticleTimer = 0;
      if (mood === 'ecstatic') {
        this.spawnStars(2);
      } else if (mood === 'distressed') {
        this.spawnBubbles(1);
      }
    }

    // Keep overhead billboard synced with live hunger & happiness %
    this.updateSpeechBubble(false);
  }

  public update(deltaTime: number, camera?: THREE.Camera) {
    this.animTime += deltaTime;

    const state = petManager.getState();

    // Update 3D Visual Mood Indicator System
    this.updateMoodVisuals(deltaTime, state);

    // Idle breathing & bobbing (scales with mood energy)
    const mood = petManager.getMood();
    const breathSpeed = state.isSleeping ? 1.5 : mood === 'ecstatic' ? 4.2 : mood === 'sad' ? 2.0 : 3.0;
    const breathAmount = state.isSleeping ? 0.03 : mood === 'ecstatic' ? 0.065 : 0.045;
    const breath = Math.sin(this.animTime * breathSpeed);

    this.headGroup.scale.y = 1.0 + breath * breathAmount;
    this.headGroup.scale.x = 1.0 - breath * (breathAmount * 0.5);
    this.headGroup.scale.z = 1.0 - breath * (breathAmount * 0.5);

    // Ear wobbly damping & droop when sad/hungry
    if (this.earsGroup.children.length > 0) {
      const earWobble = Math.sin(this.animTime * (breathSpeed * 1.5)) * 0.08;
      const earDroop = state.happiness < 45 ? 0.25 : 0;
      this.earsGroup.children.forEach((ear, idx) => {
        const side = idx % 2 === 0 ? 1 : -1;
        ear.rotation.x = -0.1 + earWobble * side;
        if (this.earsGroup.children.length === 2) {
          ear.rotation.z = side * (0.25 + earDroop);
        }
      });
    }

    // Wing flapping
    if (this.wingsGroup.children.length > 0) {
      const flapSpeed = state.isSleeping ? 1.0 : mood === 'ecstatic' ? 11.0 : mood === 'sad' ? 3.5 : 8.0;
      const wingFlap = Math.sin(this.animTime * flapSpeed) * 0.35;
      if (this.wingsGroup.children[0]) {
        this.wingsGroup.children[0].rotation.y = wingFlap;
      }
      if (this.wingsGroup.children[1]) {
        this.wingsGroup.children[1].rotation.y = -wingFlap;
      }
    }

    // Tail wagging speed scales with happiness
    if (this.tailGroup.children.length > 0) {
      const wagSpeed = (1.5 + (state.happiness / 100) * 6.0);
      const tailWag = Math.sin(this.animTime * wagSpeed) * 0.22;
      this.tailGroup.children.forEach((t) => {
        t.rotation.y = tailWag;
      });
    }

    // Blinking animation
    this.blinkTimer -= deltaTime;
    if (this.blinkTimer <= 0) {
      this.isBlinking = true;
      this.blinkProgress = 0;
      this.blinkTimer = 2.5 + Math.random() * 3.5;
    }

    if (this.isBlinking) {
      this.blinkProgress += deltaTime * 12;
      const eyeScaleY = Math.max(0.08, Math.abs(Math.sin(this.blinkProgress * Math.PI)));
      if (this.leftEyeMesh && this.rightEyeMesh) {
        this.leftEyeMesh.scale.y = eyeScaleY * 1.15;
        this.rightEyeMesh.scale.y = eyeScaleY * 1.15;
      }
      if (this.blinkProgress >= 1.0) {
        this.isBlinking = false;
        if (this.leftEyeMesh && this.rightEyeMesh) {
          this.leftEyeMesh.scale.y = 1.15;
          this.rightEyeMesh.scale.y = 1.15;
        }
      }
    } else if (this.leftEyeMesh && this.rightEyeMesh && !state.isSleeping) {
      // Half-lidded sad/hungry eyes vs wide ecstatic eyes
      const baseEyeScaleY = mood === 'sad' || mood === 'distressed' ? 0.82 : mood === 'ecstatic' ? 1.25 : 1.15;
      this.leftEyeMesh.scale.y = baseEyeScaleY;
      this.rightEyeMesh.scale.y = baseEyeScaleY;
    }

    // Sleeping closed eyes
    if (state.isSleeping && this.leftEyeMesh && this.rightEyeMesh) {
      this.leftEyeMesh.scale.y = 0.12;
      this.rightEyeMesh.scale.y = 0.12;
    }

    // 3D Multi-Stage Feeding Animation (Food flight -> 3 Chomps + Crumb Bursts -> Happy Hop)
    if (this.isEatingAnim) {
      this.eatingAnimTime += deltaTime;
      const t = this.eatingAnimTime;

      if (t < 0.32) {
        // Phase 1: Parabolic flight of 3D food prop from front towards pet's mouth
        const p = t / 0.32;
        if (this.activeFoodProp) {
          this.activeFoodProp.position.set(
            0,
            0.26 - p * 0.115 + Math.sin(p * Math.PI) * 0.08,
            0.38 - p * 0.175
          );
          this.activeFoodProp.rotation.y += deltaTime * 8;
        }
        // Pet leans forward eagerly with open mouth
        this.bodyGroup.rotation.x = p * 0.18;
      } else if (t < 1.42) {
        // Phase 2: 3-Bite Chomp Sequence synchronized with multi-bite audio
        if (this.activeFoodProp) {
          this.activeFoodProp.position.set(0, 0.145, 0.205);
          this.activeFoodProp.rotation.y += deltaTime * 5;
        }

        // Trigger bite 1, bite 2, bite 3 shrink & crumb bursts
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

        // Rhythmic chomping head bob & belly expansion
        const chompWave = Math.sin((t - 0.32) * 26);
        this.bodyGroup.rotation.x = 0.1 + chompWave * 0.12;
        this.bodyGroup.position.y = Math.abs(chompWave) * 0.04;
        if (this.bellyMesh) {
          const swell = 1.0 + ((t - 0.32) / 1.1) * 0.12;
          this.bellyMesh.scale.set(0.85 * swell, 0.9 * swell, 0.4 * swell);
        }
      } else if (t < 1.8) {
        // Phase 3: Swallow food prop & celebratory happy hop
        if (this.activeFoodProp) {
          this.clearGroup(this.feedingPropGroup);
          this.activeFoodProp = undefined;
          this.spawnStars(6);
          this.spawnHearts(4);
        }
        const hopProgress = (t - 1.42) / 0.38;
        this.bodyGroup.rotation.x = 0;
        this.bodyGroup.position.y = Math.sin(hopProgress * Math.PI) * 0.14;
      } else {
        // Finish eating animation
        this.isEatingAnim = false;
        this.clearGroup(this.feedingPropGroup);
        this.activeFoodProp = undefined;
        this.bodyGroup.rotation.x = 0;
        this.bodyGroup.position.y = 0;
      }
    }

    // 3D Soothing Grooming / Brushing Animation (4 rhythmic brush strokes across head & coat)
    if (this.isGroomingAnim) {
      this.groomingAnimTime += deltaTime;
      const t = this.groomingAnimTime;

      if (t < 1.68) {
        // 4 smooth brushing strokes synchronized with sound.playGroom()
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

        // Pet leans blissfully into the brush strokes with contented closed eyes
        this.bodyGroup.rotation.z = strokeWave * 0.12;
        this.bodyGroup.position.y = Math.abs(strokeWave) * 0.025;
        if (this.leftEyeMesh && this.rightEyeMesh) {
          this.leftEyeMesh.scale.y = 0.16;
          this.rightEyeMesh.scale.y = 0.16;
        }

        // Emit sparkle & heart bursts on each stroke peak
        const currentStroke = Math.floor(t / 0.4);
        if (currentStroke > this.groomingStrokeStage) {
          this.groomingStrokeStage = currentStroke;
          this.spawnStars(3);
          this.spawnHearts(2);
        }
      } else {
        // Finish grooming animation
        this.isGroomingAnim = false;
        this.clearGroup(this.groomingPropGroup);
        this.activeBrushProp = undefined;
        this.bodyGroup.rotation.z = 0;
        this.bodyGroup.position.y = 0;
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
