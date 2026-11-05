import * as THREE from 'three';
import { sound } from './sound';
import { petManager } from './petManager';
import { PetRenderer } from './petRenderer';

export interface MiniGameBerry {
  mesh: THREE.Group;
  type: 'strawberry' | 'blueberry' | 'golden_star';
  points: number;
  velocity: THREE.Vector3;
  rotSpeed: THREE.Vector3;
}

export class MiniGameManager extends THREE.Group {
  public activeGame: 'none' | 'berry_catch' | 'simon_dance' = 'none';

  // Berry catch state
  private berries: MiniGameBerry[] = [];
  private berrySpawnTimer: number = 0;
  private gameTimer: number = 0;
  public score: number = 0;
  public combo: number = 0;
  private onGameFinished?: (result: { score: number; happinessGain: number; expGain: number }) => void;
  private onScoreUpdate?: (score: number, timeSec: number, combo: number) => void;

  // Simon dance state
  private simonSequence: number[] = [];
  private playerInputSequence: number[] = [];
  public simonRound: number = 1;
  public isPetDancing: boolean = false;
  private simonMoveIndex: number = 0;
  private simonMoveTimer: number = 0;
  private onSimonStep?: (move: number, isPlayerTurn: boolean) => void;

  private petRef?: PetRenderer;

  constructor() {
    super();
    this.name = 'MiniGameManager';
  }

  public setPet(pet: PetRenderer) {
    this.petRef = pet;
  }

  public startBerryCatch(
    onScoreUpdate: (score: number, timeSec: number, combo: number) => void,
    onGameFinished: (result: { score: number; happinessGain: number; expGain: number }) => void
  ) {
    this.cleanup();
    this.activeGame = 'berry_catch';
    this.score = 0;
    this.combo = 0;
    this.gameTimer = 25.0; // 25 second fast-paced arcade
    this.berrySpawnTimer = 0.4;
    this.onScoreUpdate = onScoreUpdate;
    this.onGameFinished = onGameFinished;

    petManager.say('Catch the falling berries before they drop! Ready... GO! 🍓', 3);
    sound.playLevelUp();
  }

  public startSimonDance(
    onSimonStep: (move: number, isPlayerTurn: boolean) => void,
    onGameFinished: (result: { score: number; happinessGain: number; expGain: number }) => void
  ) {
    this.cleanup();
    this.activeGame = 'simon_dance';
    this.score = 0;
    this.simonRound = 1;
    this.onSimonStep = onSimonStep;
    this.onGameFinished = onGameFinished;
    this.nextSimonRound();
  }

  private nextSimonRound() {
    this.simonSequence = [];
    this.playerInputSequence = [];
    const sequenceLength = 2 + this.simonRound;
    for (let i = 0; i < sequenceLength; i++) {
      this.simonSequence.push(Math.floor(Math.random() * 4));
    }

    this.isPetDancing = true;
    this.simonMoveIndex = 0;
    this.simonMoveTimer = 0.5;
    petManager.say(`Round ${this.simonRound}! Watch my dance moves! 🎵`, 3);
  }

  public handlePlayerSimonInput(moveIndex: number) {
    if (this.activeGame !== 'simon_dance' || this.isPetDancing) return;

    sound.playSimonTone(moveIndex);
    this.performDanceMove(moveIndex);
    this.playerInputSequence.push(moveIndex);

    const currentStep = this.playerInputSequence.length - 1;
    if (this.playerInputSequence[currentStep] !== this.simonSequence[currentStep]) {
      // Mistake!
      sound.playChirp(0.6);
      petManager.say('Oops! Nice try! Let’s practice more! 💖', 3);
      this.finishGame();
      return;
    }

    // Correct move!
    this.score += 50 * this.simonRound;

    if (this.playerInputSequence.length === this.simonSequence.length) {
      // Completed round!
      sound.playHappy();
      this.petRef?.triggerFlip();
      this.petRef?.spawnStars(8);
      petManager.say(`Perfect groove! Round ${this.simonRound} cleared! 🌟`, 2.5);

      if (this.simonRound >= 5) {
        // Master of dance!
        this.finishGame();
      } else {
        this.simonRound += 1;
        setTimeout(() => {
          if (this.activeGame === 'simon_dance') {
            this.nextSimonRound();
          }
        }, 1200);
      }
    }
  }

  private performDanceMove(move: number) {
    if (!this.petRef) return;
    if (move === 0) {
      // Left hop
      this.petRef.position.x = -0.15;
      setTimeout(() => {
        if (this.petRef) this.petRef.position.x = 0;
      }, 300);
    } else if (move === 1) {
      // High jump
      this.petRef.position.y += 0.15;
      setTimeout(() => {
        if (this.petRef) this.petRef.position.y -= 0.15;
      }, 300);
    } else if (move === 2) {
      // Right hop
      this.petRef.position.x = 0.15;
      setTimeout(() => {
        if (this.petRef) this.petRef.position.x = 0;
      }, 300);
    } else {
      // 360 Spin
      this.petRef.triggerFlip();
    }
  }

  public update(deltaTime: number) {
    if (this.activeGame === 'berry_catch') {
      this.updateBerryCatch(deltaTime);
    } else if (this.activeGame === 'simon_dance') {
      this.updateSimonDance(deltaTime);
    }
  }

  private updateBerryCatch(deltaTime: number) {
    this.gameTimer -= deltaTime;
    if (this.gameTimer <= 0) {
      this.gameTimer = 0;
      this.onScoreUpdate?.(this.score, 0, this.combo);
      this.finishGame();
      return;
    }

    this.onScoreUpdate?.(this.score, Math.ceil(this.gameTimer), this.combo);

    // Spawn berries
    this.berrySpawnTimer -= deltaTime;
    if (this.berrySpawnTimer <= 0) {
      this.spawnBerry();
      this.berrySpawnTimer = 0.5 + Math.random() * 0.4;
    }

    // Move berries
    for (let i = this.berries.length - 1; i >= 0; i--) {
      const b = this.berries[i];
      b.mesh.position.addScaledVector(b.velocity, deltaTime);
      b.mesh.rotation.x += b.rotSpeed.x * deltaTime;
      b.mesh.rotation.y += b.rotSpeed.y * deltaTime;

      // Fallen to floor
      if (b.mesh.position.y < 0.6) {
        this.remove(b.mesh);
        this.disposeBerryMesh(b.mesh);
        this.berries.splice(i, 1);
        this.combo = 0; // reset combo
      }
    }
  }

  private spawnBerry() {
    const types: Array<'strawberry' | 'blueberry' | 'golden_star'> = [
      'strawberry',
      'strawberry',
      'blueberry',
      'blueberry',
      'golden_star',
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    const group = new THREE.Group();
    group.xb = { manipulation: true };

    let points = 50;
    if (type === 'strawberry') {
      const geo = new THREE.ConeGeometry(0.04, 0.07, 12);
      const mat = new THREE.MeshStandardMaterial({ color: 0xff1744, roughness: 0.3 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = Math.PI;
      group.add(mesh);
      points = 60;
    } else if (type === 'blueberry') {
      const geo = new THREE.SphereGeometry(0.038, 14, 12);
      const mat = new THREE.MeshStandardMaterial({ color: 0x3d5afe, roughness: 0.3 });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      points = 40;
    } else {
      // Golden star
      const geo = new THREE.OctahedronGeometry(0.045);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffb700,
        emissiveIntensity: 0.5,
        roughness: 0.2,
      });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      points = 120;
    }

    // Position in reachable semi-circle in front of user
    const angle = (Math.random() - 0.5) * 1.4;
    const distance = 0.75 + Math.random() * 0.45;
    const spawnX = Math.sin(angle) * distance;
    const spawnZ = -Math.cos(angle) * distance;
    const spawnY = 1.6 + Math.random() * 0.4;

    group.position.set(spawnX, spawnY, spawnZ);
    this.add(group);

    const fallSpeed = -(0.35 + Math.random() * 0.3);
    this.berries.push({
      mesh: group,
      type,
      points,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.1, fallSpeed, 0),
      rotSpeed: new THREE.Vector3(1 + Math.random() * 2, 1 + Math.random() * 2, 0),
    });
  }

  public catchBerryByMesh(targetMesh: THREE.Object3D): boolean {
    if (this.activeGame !== 'berry_catch') return false;

    // Search in berries
    const idx = this.berries.findIndex((b) => b.mesh === targetMesh || b.mesh.children.includes(targetMesh as THREE.Mesh));
    if (idx !== -1) {
      const berry = this.berries[idx];
      this.combo += 1;
      const gained = berry.points * (1 + Math.min(this.combo * 0.2, 2.0));
      this.score += Math.round(gained);

      sound.playCatch(this.combo);
      this.petRef?.spawnHearts(3);
      if (this.combo % 5 === 0) {
        this.petRef?.triggerFlip();
        petManager.say(`Combo x${this.combo}! Awesome reflexes! 🔥`, 2);
      }

      this.remove(berry.mesh);
      this.disposeBerryMesh(berry.mesh);
      this.berries.splice(idx, 1);
      return true;
    }
    return false;
  }

  private updateSimonDance(deltaTime: number) {
    if (!this.isPetDancing) return;

    this.simonMoveTimer -= deltaTime;
    if (this.simonMoveTimer <= 0) {
      if (this.simonMoveIndex < this.simonSequence.length) {
        const move = this.simonSequence[this.simonMoveIndex];
        sound.playSimonTone(move);
        this.performDanceMove(move);
        this.onSimonStep?.(move, false);

        this.simonMoveIndex += 1;
        this.simonMoveTimer = 0.75;
      } else {
        // Finished dance presentation, player turn!
        this.isPetDancing = false;
        this.playerInputSequence = [];
        this.onSimonStep?.(-1, true);
        petManager.say('Your turn! Repeat the rhythm! 🎶', 3);
      }
    }
  }

  public finishGame() {
    const finalScore = this.score;
    const happinessGain = Math.min(50, Math.max(20, Math.round(finalScore / 15)));
    const expGain = Math.min(250, Math.max(50, Math.round(finalScore / 5)));

    petManager.recordMiniGameResult(finalScore, happinessGain, expGain);

    if (this.onGameFinished) {
      this.onGameFinished({
        score: finalScore,
        happinessGain,
        expGain,
      });
    }

    this.cleanup();
  }

  public cleanup() {
    this.activeGame = 'none';
    for (const b of this.berries) {
      this.remove(b.mesh);
      this.disposeBerryMesh(b.mesh);
    }
    this.berries = [];
    this.isPetDancing = false;
  }

  private disposeBerryMesh(group: THREE.Group) {
    group.children.forEach((c) => {
      if ((c as THREE.Mesh).geometry) {
        (c as THREE.Mesh).geometry.dispose();
      }
    });
  }
}
