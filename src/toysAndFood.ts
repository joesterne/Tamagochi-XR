import * as THREE from 'three';
import { sound } from './sound';
import { petManager } from './petManager';

export class FoodObject extends THREE.Group {
  public foodType: 'apple' | 'cake' | 'sushi' | 'cookie';
  public isEaten: boolean = false;

  constructor(foodType: 'apple' | 'cake' | 'sushi' | 'cookie') {
    super();
    this.foodType = foodType;
    this.xb = { manipulation: true };
    this.buildFoodMesh();
  }

  private buildFoodMesh() {
    if (this.foodType === 'apple') {
      const appleGeo = new THREE.SphereGeometry(0.045, 16, 16);
      const appleMat = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.3 });
      const apple = new THREE.Mesh(appleGeo, appleMat);

      // Stem & leaf
      const stemGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.025, 8);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x582f0e });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.045;

      const leafGeo = new THREE.ConeGeometry(0.015, 0.03, 4);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x55a630 });
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(0.01, 0.045, 0);
      leaf.rotation.z = -1.2;

      this.add(apple, stem, leaf);
    } else if (this.foodType === 'cake') {
      // Cake slice
      const cakeGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16);
      const cakeMat = new THREE.MeshStandardMaterial({ color: 0xffccd5, roughness: 0.5 });
      const cake = new THREE.Mesh(cakeGeo, cakeMat);

      // Strawberry on top
      const berryGeo = new THREE.ConeGeometry(0.018, 0.03, 12);
      const berryMat = new THREE.MeshStandardMaterial({ color: 0xd90429, roughness: 0.3 });
      const berry = new THREE.Mesh(berryGeo, berryMat);
      berry.position.y = 0.03;

      this.add(cake, berry);
    } else if (this.foodType === 'sushi') {
      // Sushi roll
      const riceGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.035, 16);
      const riceMat = new THREE.MeshStandardMaterial({ color: 0xfdfdfd, roughness: 0.8 });
      const rice = new THREE.Mesh(riceGeo, riceMat);

      // Salmon topping
      const salmonGeo = new THREE.BoxGeometry(0.065, 0.015, 0.045);
      const salmonMat = new THREE.MeshStandardMaterial({ color: 0xff70a6, roughness: 0.4 });
      const salmon = new THREE.Mesh(salmonGeo, salmonMat);
      salmon.position.y = 0.022;

      // Seaweed nori belt
      const noriGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.015, 16, 1, true);
      const noriMat = new THREE.MeshStandardMaterial({ color: 0x1a2e1a, roughness: 0.6 });
      const nori = new THREE.Mesh(noriGeo, noriMat);

      this.add(rice, salmon, nori);
    } else {
      // Choco chip cookie
      const cookieGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.018, 20);
      const cookieMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.7 });
      const cookie = new THREE.Mesh(cookieGeo, cookieMat);

      // Chips
      const chipMat = new THREE.MeshStandardMaterial({ color: 0x3d261d, roughness: 0.3 });
      for (let i = 0; i < 5; i++) {
        const chip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), chipMat);
        const a = (i / 5) * Math.PI * 2 + 0.3;
        chip.position.set(Math.cos(a) * 0.028, 0.009, Math.sin(a) * 0.028);
        chip.scale.y = 0.4;
        cookie.add(chip);
      }
      this.add(cookie);
    }
  }
}

export class BouncyBall extends THREE.Group {
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public isHeld: boolean = false;
  private sphereMesh: THREE.Mesh;
  private radius: number = 0.06;

  constructor() {
    super();
    this.name = 'BouncyBall';
    this.xb = { manipulation: true };

    const ballGeo = new THREE.SphereGeometry(this.radius, 24, 20);
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0x00f5d4,
      roughness: 0.2,
      metalness: 0.2,
    });
    this.sphereMesh = new THREE.Mesh(ballGeo, ballMat);

    // Star stripe on ball
    const stripeGeo = new THREE.TorusGeometry(this.radius * 0.99, 0.008, 8, 24);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffe600 });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.rotation.x = Math.PI / 2;
    this.sphereMesh.add(stripe);

    this.add(this.sphereMesh);
  }

  public launch(direction: THREE.Vector3, speed: number = 2.5) {
    this.velocity.copy(direction).multiplyScalar(speed);
    sound.playCatch(2);
  }

  public update(deltaTime: number, floorY: number = 0.8) {
    if (this.isHeld) return;

    // Gravity
    this.velocity.y -= 9.8 * deltaTime;

    // Move
    this.position.addScaledVector(this.velocity, deltaTime);

    // Floor bounce
    if (this.position.y <= floorY + this.radius) {
      this.position.y = floorY + this.radius;
      if (Math.abs(this.velocity.y) > 0.4) {
        this.velocity.y = -this.velocity.y * 0.72; // restitution
        this.velocity.x *= 0.88;
        this.velocity.z *= 0.88;
        sound.playChirp(0.8);
      } else {
        this.velocity.y = 0;
        this.velocity.x *= 0.7;
        this.velocity.z *= 0.7;
      }
    }
  }
}

export class BubbleSponge extends THREE.Group {
  private spongeMesh: THREE.Mesh;

  constructor() {
    super();
    this.name = 'BubbleSponge';
    this.xb = { manipulation: true };

    const spongeGeo = new THREE.BoxGeometry(0.12, 0.05, 0.08);
    const spongeMat = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      roughness: 0.9,
    });
    this.spongeMesh = new THREE.Mesh(spongeGeo, spongeMat);

    // Foam top
    const foamGeo = new THREE.BoxGeometry(0.122, 0.02, 0.082);
    const foamMat = new THREE.MeshStandardMaterial({
      color: 0x06d6a0,
      roughness: 0.8,
    });
    const foam = new THREE.Mesh(foamGeo, foamMat);
    foam.position.y = 0.025;
    this.spongeMesh.add(foam);

    this.add(this.spongeMesh);
  }
}
