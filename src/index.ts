import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as xb from 'xrblocks';
import { PetRenderer } from './petRenderer';
import { petManager } from './petManager';
import { TamagotchiSpatialUI } from './spatialUI';
import { MiniGameManager } from './miniGames';
import { BouncyBall } from './toysAndFood';
import { DailyStreakShrine } from './streakShrine';
import { sound } from './sound';

// Pre-allocated scratch vectors for zero-GC update loop
const _ballDir = new THREE.Vector3();
const _launchDir = new THREE.Vector3();

class TamagotchiXRScene extends xb.Script {
  private pet!: PetRenderer;
  private streakShrine!: DailyStreakShrine;
  private spatialUI!: TamagotchiSpatialUI;
  private miniGames!: MiniGameManager;
  private bouncyBall!: BouncyBall;
  private dirLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;

  private clock = new THREE.Clock();
  private floorY = 0.8;

  init() {
    // 1. Studio PBR Tone Mapping & RoomEnvironment Reflections
    const renderer = xb.core.renderer;
    if (renderer instanceof THREE.WebGLRenderer) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      xb.core.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    }

    // 2. Warm/Cool Studio Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x3b3346, 2.2);
    this.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff1e0, 2.2);
    this.dirLight.position.set(1.5, 4, 1.2);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.02;
    this.add(this.dirLight);

    // 3. Pet 3D Renderer (Grounded with contact shadow)
    this.pet = new PetRenderer();
    this.pet.position.set(0, 1.05, -0.85);
    this.add(this.pet);

    // 4. 3D Daily Streak Shrine & 24h Reward Chest
    this.streakShrine = new DailyStreakShrine();
    this.streakShrine.position.set(0.42, 0.85, -0.95);
    this.streakShrine.rotation.y = -0.35;
    this.add(this.streakShrine);

    // Listen for any daily streak reward claim (from petting, feeding, mini-games, or shrine click)
    petManager.onStreakRewardClaimed(() => {
      this.streakShrine.triggerCelebrationBurst();
      this.pet.spawnStars(12);
      this.pet.spawnHearts(8);
      this.pet.triggerFlip();
    });

    // 5. Mini Games Manager
    this.miniGames = new MiniGameManager();
    this.miniGames.setPet(this.pet);
    this.add(this.miniGames);

    // 6. Interactive Toy Bouncy Ball
    this.bouncyBall = new BouncyBall();
    this.bouncyBall.position.set(0.28, 1.0, -0.72);
    this.add(this.bouncyBall);

    // 7. Spatial UI Card
    this.spatialUI = new TamagotchiSpatialUI(this.pet, this.miniGames, this.streakShrine);
    this.spatialUI.card.position.set(-0.55, 1.45, -1.05);
    this.spatialUI.card.rotation.y = 0.25;
    this.add(this.spatialUI.card);

    // Initial greeting
    setTimeout(() => {
      if (petManager.isStreakRewardAvailable()) {
        petManager.say('🔥 Daily Streak Ready! Pet me or tap the Streak Shrine to claim!', 5);
      } else {
        petManager.say('Welcome back to Tamagotchi XR! Tap or pinch me to play! ❤️', 5);
      }
      sound.playHappy();
    }, 800);
  }

  update() {
    const deltaTime = Math.min(this.clock.getDelta(), 0.1);

    // Real-time needs & 24h streak progression
    petManager.tick(deltaTime);

    // Pet & Shrine animations
    const camera = xb.core.camera;
    this.pet.update(deltaTime, camera);
    this.streakShrine.update(deltaTime, camera);

    // Mini-games update
    this.miniGames.update(deltaTime);

    // Bouncy ball physics
    this.bouncyBall.update(deltaTime, this.floorY);

    // If ball was thrown away, pet playfully watches and fetches it!
    const ballDist = this.pet.position.distanceTo(this.bouncyBall.position);
    if (ballDist > 0.3 && ballDist < 2.0 && this.bouncyBall.velocity.length() < 0.2) {
      _ballDir.subVectors(this.bouncyBall.position, this.pet.position);
      _ballDir.y = 0;
      _ballDir.normalize();
      this.pet.position.addScaledVector(_ballDir, deltaTime * 0.4);

      if (ballDist < 0.35) {
        _launchDir.set(0, 0.4, 0.2);
        this.bouncyBall.launch(_launchDir, 1.2);
        this.pet.triggerFlip();
        this.pet.spawnHearts(4);
        sound.playCatch(1);
        petManager.recordDailyInteraction('Ball Fetch');
        petManager.say('I fetched the ball! Yay! 🎾 (+10 XP)', 3);
        petManager.gainExp(10);
      }
    }

    // Sleep mode lighting effect with exponential damping
    const isSleeping = petManager.getState().isSleeping;
    const targetHemi = isSleeping ? 0.7 : 2.2;
    const targetDir = isSleeping ? 0.4 : 2.2;
    this.hemiLight.intensity = THREE.MathUtils.damp(this.hemiLight.intensity, targetHemi, 3.0, deltaTime);
    this.dirLight.intensity = THREE.MathUtils.damp(this.dirLight.intensity, targetDir, 3.0, deltaTime);
  }

  onSelectStart(event: xb.SelectEvent) {
    const target = event.target as THREE.Object3D | undefined;
    if (!target) return;

    // Check if player clicked a falling berry during Berry Catch game
    if (this.miniGames.activeGame === 'berry_catch') {
      const caught = this.miniGames.catchBerryByMesh(target);
      if (caught) {
        event.stopPropagation();
        return;
      }
    }

    // Check if player clicked the 3D Daily Streak Shrine
    if (this.isDescendantOf(target, this.streakShrine)) {
      const reward = petManager.recordDailyInteraction('Streak Shrine');
      if (!reward) {
        sound.playChirp(1.15);
        const state = petManager.getState();
        petManager.say(
          `🔥 ${state.dailyStreak}-Day Streak! ${petManager.getStreakCountdownFormatted()}`,
          4
        );
      }
      this.spatialUI.refreshStreakPanelUI();
      event.stopPropagation();
      return;
    }

    // Check if player clicked the Pet itself
    if (this.isDescendantOf(target, this.pet)) {
      petManager.pet();
      this.pet.spawnHearts(6);
      this.pet.triggerFlip();
      event.stopPropagation();
      return;
    }

    // Check if player clicked the Bouncy Ball
    if (this.isDescendantOf(target, this.bouncyBall)) {
      _launchDir
        .set(
          (Math.random() - 0.5) * 0.8,
          0.8 + Math.random() * 0.4,
          -1.0 - Math.random() * 0.5
        )
        .normalize();
      this.bouncyBall.launch(_launchDir, 2.2);
      this.pet.spawnStars(4);
      petManager.recordDailyInteraction('Play Fetch');
      petManager.say('Fetch! Go get it! 🎾', 3);
      event.stopPropagation();
      return;
    }
  }

  private isDescendantOf(target: THREE.Object3D, parentGroup: THREE.Object3D): boolean {
    let curr: THREE.Object3D | null = target;
    while (curr) {
      if (curr === parentGroup) return true;
      curr = curr.parent;
    }
    return false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const options = new xb.Options();
  options.enableReticles();
  options.enableHands();
  options.hands.visualization = true;
  options.hands.visualizeJoints = true;

  options.setAppTitle('Tamagotchi XR');
  options.setAppDescription(
    'Virtual pet companion with 24-hour Daily Streak rewards, real-time needs tracking, 3D avatar stylist, daily mini-games, and social growth leaderboards.'
  );

  xb.add(new TamagotchiXRScene());
  xb.init(options);
});
