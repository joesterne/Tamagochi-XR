import * as THREE from 'three';
import { PetAccessory, PetColorDef, PetExpression, PetSpecies, PetState } from './types';
import { PET_COLORS, petManager } from './petManager';

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

  // Materials
  private bodyMaterial: THREE.MeshStandardMaterial;
  private secondaryMaterial: THREE.MeshStandardMaterial;
  private eyeMaterial: THREE.MeshBasicMaterial;
  private pupilMaterial: THREE.MeshBasicMaterial;
  private cheekMaterial: THREE.MeshBasicMaterial;
  private goldMaterial: THREE.MeshStandardMaterial;

  // Eye meshes for animations
  private leftEyeMesh?: THREE.Mesh;
  private rightEyeMesh?: THREE.Mesh;
  private leftPupilMesh?: THREE.Mesh;
  private rightPupilMesh?: THREE.Mesh;
  private leftCheek?: THREE.Mesh;
  private rightCheek?: THREE.Mesh;
  private mouthMesh?: THREE.Mesh;

  // Speech bubble billboard
  private speechCanvas: HTMLCanvasElement;
  private speechTexture: THREE.CanvasTexture;
  private speechMesh: THREE.Mesh;

  // Animation states
  private animTime: number = 0;
  private blinkTimer: number = 3;
  private isBlinking: boolean = false;
  private blinkProgress: number = 0;
  private flipTime: number = 0;
  private isFlipping: boolean = false;
  private currentScaleTarget: number = 1.0;

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

    this.add(this.bodyGroup);
    this.bodyGroup.add(this.headGroup);
    this.headGroup.add(this.faceGroup);
    this.headGroup.add(this.earsGroup);
    this.headGroup.add(this.wingsGroup);
    this.headGroup.add(this.tailGroup);
    this.headGroup.add(this.hornsGroup);
    this.headGroup.add(this.accessoryGroup);
    this.add(this.particlesGroup);

    // Speech bubble 2D canvas
    this.speechCanvas = document.createElement('canvas');
    this.speechCanvas.width = 512;
    this.speechCanvas.height = 160;
    this.speechTexture = new THREE.CanvasTexture(this.speechCanvas);
    this.speechTexture.colorSpace = THREE.SRGBColorSpace;

    const speechGeo = new THREE.PlaneGeometry(0.55, 0.17);
    const speechMat = new THREE.MeshBasicMaterial({
      map: this.speechTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.speechMesh = new THREE.Mesh(speechGeo, speechMat);
    this.speechMesh.position.set(0, 0.42, 0);
    this.add(this.speechMesh);

    this.rebuildModel(petManager.getState());
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
    this.updateSpeechBubble();
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
    // Main Body: smooth chubby pear or spherical shape
    let bodyGeo: THREE.BufferGeometry;
    if (species === 'blobby') {
      bodyGeo = new THREE.SphereGeometry(0.18, 32, 24);
    } else if (species === 'pipsqueak') {
      bodyGeo = new THREE.SphereGeometry(0.16, 32, 24);
    } else if (species === 'draco') {
      bodyGeo = new THREE.SphereGeometry(0.17, 32, 24);
    } else {
      // kitsune
      bodyGeo = new THREE.SphereGeometry(0.17, 32, 24);
    }

    const mainBody = new THREE.Mesh(bodyGeo, this.bodyMaterial);
    mainBody.position.set(0, 0.16, 0);
    mainBody.scale.set(1.0, 0.95, 0.95);
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    this.headGroup.add(mainBody);

    // Chubby Belly patch (secondary material)
    const bellyGeo = new THREE.SphereGeometry(0.13, 24, 16);
    const belly = new THREE.Mesh(bellyGeo, this.secondaryMaterial);
    belly.position.set(0, 0.14, 0.08);
    belly.scale.set(0.85, 0.9, 0.4);
    this.headGroup.add(belly);

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

    // Cheeks
    const cheekGeo = new THREE.SphereGeometry(0.028, 16, 10);
    this.leftCheek = new THREE.Mesh(cheekGeo, this.cheekMaterial);
    this.leftCheek.position.set(-0.11, 0.145, 0.125);
    this.leftCheek.scale.set(1, 0.5, 0.3);

    this.rightCheek = new THREE.Mesh(cheekGeo, this.cheekMaterial);
    this.rightCheek.position.set(0.11, 0.145, 0.125);
    this.rightCheek.scale.set(1, 0.5, 0.3);

    // Mouth: cute little curved line or open smile
    const mouthGeo = new THREE.TorusGeometry(0.018, 0.004, 8, 16, Math.PI);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x331122 });
    this.mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
    this.mouthMesh.rotation.z = Math.PI;
    this.mouthMesh.position.set(0, 0.14, 0.158);

    this.faceGroup.add(
      this.leftEyeMesh,
      this.rightEyeMesh,
      this.leftCheek,
      this.rightCheek,
      this.mouthMesh
    );
  }

  private buildSpeciesFeatures(species: PetSpecies) {
    if (species === 'blobby') {
      // Bouncy Bunny/Jelly Ears
      const earGeo = new THREE.ConeGeometry(0.045, 0.14, 16);
      const leftEar = new THREE.Mesh(earGeo, this.bodyMaterial);
      leftEar.position.set(-0.08, 0.32, -0.02);
      leftEar.rotation.z = 0.25;
      leftEar.rotation.x = -0.1;

      const rightEar = new THREE.Mesh(earGeo, this.bodyMaterial);
      rightEar.position.set(0.08, 0.32, -0.02);
      rightEar.rotation.z = -0.25;
      rightEar.rotation.x = -0.1;

      // Inner ear pink
      const innerEarGeo = new THREE.ConeGeometry(0.028, 0.1, 16);
      const innerLeft = new THREE.Mesh(innerEarGeo, this.secondaryMaterial);
      innerLeft.position.set(0, -0.01, 0.015);
      leftEar.add(innerLeft);

      const innerRight = new THREE.Mesh(innerEarGeo, this.secondaryMaterial);
      innerRight.position.set(0, -0.01, 0.015);
      rightEar.add(innerRight);

      this.earsGroup.add(leftEar, rightEar);
    } else if (species === 'pipsqueak') {
      // Golden Beak
      const beakGeo = new THREE.ConeGeometry(0.03, 0.05, 12);
      const beakMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.3 });
      const beak = new THREE.Mesh(beakGeo, beakMat);
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.165, 0.165);
      this.faceGroup.add(beak);

      // Cute feathery crest on head
      const crestGeo = new THREE.ConeGeometry(0.035, 0.09, 10);
      const crest = new THREE.Mesh(crestGeo, this.secondaryMaterial);
      crest.position.set(0, 0.31, 0.02);
      crest.rotation.x = -0.3;
      this.earsGroup.add(crest);

      // Flapping wings
      const wingGeo = new THREE.BoxGeometry(0.03, 0.08, 0.12);
      const leftWing = new THREE.Mesh(wingGeo, this.bodyMaterial);
      leftWing.position.set(-0.16, 0.16, 0);
      leftWing.rotation.z = -0.3;

      const rightWing = new THREE.Mesh(wingGeo, this.bodyMaterial);
      rightWing.position.set(0.16, 0.16, 0);
      rightWing.rotation.z = 0.3;

      this.wingsGroup.add(leftWing, rightWing);
    } else if (species === 'draco') {
      // Dragon Horns
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

      // Dragon Wings
      const wingShape = new THREE.ConeGeometry(0.07, 0.16, 4);
      const leftWing = new THREE.Mesh(wingShape, this.secondaryMaterial);
      leftWing.position.set(-0.16, 0.2, -0.08);
      leftWing.rotation.set(0.5, -0.3, 1.2);

      const rightWing = new THREE.Mesh(wingShape, this.secondaryMaterial);
      rightWing.position.set(0.16, 0.2, -0.08);
      rightWing.rotation.set(0.5, 0.3, -1.2);

      this.wingsGroup.add(leftWing, rightWing);

      // Dragon Tail
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
      // Pointy Fox Ears
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

      // Mystical Forehead Jewel
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

      // Fluffy curved Kitsune tails (2 tails)
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

      // 5 crown spikes
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.04, 8), this.goldMaterial);
        spike.position.set(Math.cos(angle) * 0.065, 0.025, Math.sin(angle) * 0.065);
        crown.add(spike);

        // Gem atop each spike
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

      // Gold star on hat
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

      for (let side of [-1, 1]) {
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

  public updateSpeechBubble() {
    const text = petManager.getSpeechBubble();
    const ctx = this.speechCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, this.speechCanvas.width, this.speechCanvas.height);

    // Rounded speech bubble background
    const x = 16;
    const y = 16;
    const w = this.speechCanvas.width - 32;
    const h = this.speechCanvas.height - 48;
    const r = 24;

    ctx.fillStyle = 'rgba(20, 24, 38, 0.88)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);

    // Downward tail
    ctx.lineTo(x + w / 2 + 20, y + h);
    ctx.lineTo(x + w / 2, y + h + 24);
    ctx.lineTo(x + w / 2 - 20, y + h);

    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    // Text rendering
    ctx.font = 'bold 30px "Google Sans", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, this.speechCanvas.width / 2, y + h / 2);

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

  public update(deltaTime: number, camera?: THREE.Camera) {
    this.animTime += deltaTime;

    const state = petManager.getState();

    // Idle breathing & bobbing
    const breathSpeed = state.isSleeping ? 1.5 : 3.0;
    const breathAmount = state.isSleeping ? 0.03 : 0.05;
    const breath = Math.sin(this.animTime * breathSpeed);

    this.headGroup.scale.y = 1.0 + breath * breathAmount;
    this.headGroup.scale.x = 1.0 - breath * (breathAmount * 0.5);
    this.headGroup.scale.z = 1.0 - breath * (breathAmount * 0.5);

    // Ear wobbly damping
    if (this.earsGroup.children.length > 0) {
      const earWobble = Math.sin(this.animTime * (breathSpeed * 1.5)) * 0.08;
      this.earsGroup.children.forEach((ear, idx) => {
        ear.rotation.x = -0.1 + earWobble * (idx % 2 === 0 ? 1 : -1);
      });
    }

    // Wing flapping
    if (this.wingsGroup.children.length > 0) {
      const flapSpeed = state.isSleeping ? 1.0 : 8.0;
      const wingFlap = Math.sin(this.animTime * flapSpeed) * 0.35;
      if (this.wingsGroup.children[0]) {
        this.wingsGroup.children[0].rotation.y = wingFlap;
      }
      if (this.wingsGroup.children[1]) {
        this.wingsGroup.children[1].rotation.y = -wingFlap;
      }
    }

    // Tail wagging
    if (this.tailGroup.children.length > 0) {
      const tailWag = Math.sin(this.animTime * 4.0) * 0.2;
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
    }

    // Sleeping closed eyes
    if (state.isSleeping && this.leftEyeMesh && this.rightEyeMesh) {
      this.leftEyeMesh.scale.y = 0.12;
      this.rightEyeMesh.scale.y = 0.12;
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

    // Billboard the speech bubble towards camera
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
  }
}
