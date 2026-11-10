import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as xb from 'xrblocks';
import { PetRenderer } from './petRenderer';
import { petManager } from './petManager';
import { TamagotchiSpatialUI } from './spatialUI';
import { MiniGameManager } from './miniGames';
import { BouncyBall, GroomingBrush, SnackPlatter } from './toysAndFood';
import { DailyStreakShrine } from './streakShrine';
import { ARPlacementSystem } from './arPlacement';
import { sound } from './sound';

// Pre-allocated scratch vectors for zero-GC update loop

class TamagotchiXRScene extends xb.Script {
  private pet!: PetRenderer;
  private streakShrine!: DailyStreakShrine;
  private arPlacement!: ARPlacementSystem;
  private spatialUI!: TamagotchiSpatialUI;
  private miniGames!: MiniGameManager;
  private bouncyBall!: BouncyBall;
  private snackPlatter!: SnackPlatter;
  private groomingBrush!: GroomingBrush;
  private dirLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;

  // Smooth damped target positions for surface anchoring
  private targetPetPos = new THREE.Vector3(0, 0.82, -0.85);
  private targetShrinePos = new THREE.Vector3(0.42, 0.8, -0.95);

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

    // 3. AR Pass-Through & WebXR Hit-Test Surface Placement System
    this.arPlacement = new ARPlacementSystem();
    this.add(this.arPlacement);

    // 4. Pet 3D Renderer (Grounded on physical surface anchor pad)
    this.pet = new PetRenderer();
    this.pet.position.copy(this.targetPetPos);
    this.add(this.pet);

    // 5. 3D Daily Streak Shrine & 24h Reward Chest
    this.streakShrine = new DailyStreakShrine();
    this.streakShrine.position.copy(this.targetShrinePos);
    this.streakShrine.rotation.y = -0.35;
    this.add(this.streakShrine);

    // Listen for any daily streak reward claim (from petting, feeding, mini-games, or shrine click)
    petManager.onStreakRewardClaimed(() => {
      this.streakShrine.triggerCelebrationBurst();
      this.pet.spawnStars(12);
      this.pet.spawnHearts(8);
      this.pet.triggerFlip();
    });

    // 6. Mini Games Manager
    this.miniGames = new MiniGameManager();
    this.miniGames.setPet(this.pet);
    this.add(this.miniGames);

    // 7. Interactive Toy Ball & 3D Snack Platter (Stationary on surface)
    this.bouncyBall = new BouncyBall();
    this.bouncyBall.position.set(0.28, this.floorY + 0.06, -0.72);
    this.add(this.bouncyBall);

    this.snackPlatter = new SnackPlatter();
    this.snackPlatter.position.set(-0.34, this.floorY, -0.76);
    this.add(this.snackPlatter);

    this.groomingBrush = new GroomingBrush();
    this.groomingBrush.position.set(0.18, this.floorY + 0.03, -0.68);
    this.groomingBrush.rotation.y = -0.45;
    this.add(this.groomingBrush);

    // 8. Spatial UI Card
    this.spatialUI = new TamagotchiSpatialUI(
      this.pet,
      this.miniGames,
      this.streakShrine,
      this.arPlacement
    );
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

  /**
   * Anchors the virtual pet, its coaster pad, the Daily Streak Shrine, and the physics floor
   * onto the targeted real-world surface coordinates obtained via WebXR Hit Test / DepthMesh.
   */
  private anchorPetAtSurfacePoint(hitPoint: THREE.Vector3) {
    this.floorY = hitPoint.y;
    this.arPlacement.setAnchoredPose(hitPoint);

    // Set smooth damped target positions for the pet and its companion shrine
    this.targetPetPos.set(hitPoint.x, hitPoint.y + 0.022, hitPoint.z);
    this.targetShrinePos.set(hitPoint.x + 0.42, hitPoint.y, hitPoint.z - 0.08);

    // Face the camera horizontally
    const camPos = xb.core.camera.position;
    this.pet.lookAt(camPos.x, this.pet.position.y, camPos.z);

    // Reposition toy ball, 3D snack platter & grooming brush stationary on the newly anchored surface
    this.bouncyBall.position.set(hitPoint.x + 0.24, hitPoint.y + 0.06, hitPoint.z + 0.12);
    this.bouncyBall.velocity.set(0, 0, 0);
    this.snackPlatter.position.set(hitPoint.x - 0.34, hitPoint.y, hitPoint.z + 0.08);
    this.groomingBrush.position.set(hitPoint.x + 0.16, hitPoint.y + 0.03, hitPoint.z + 0.18);

    // Exit placement mode & celebrate
    this.arPlacement.toggleSurfacePlacementMode(false);
    this.pet.triggerFlip();
    this.pet.spawnStars(10);
    sound.playHappy();
    petManager.recordDailyInteraction('Surface Anchor');
    petManager.say(
      `📌 Anchored onto surface at (${hitPoint.x.toFixed(2)}m, ${hitPoint.y.toFixed(2)}m, ${hitPoint.z.toFixed(2)}m)!`,
      4.5
    );
    this.spatialUI.refreshARControlsUI();
  }

  update() {
    const deltaTime = Math.min(xb.getDeltaTime() || 0.016, 0.1);

    // Real-time needs & 24h streak progression
    petManager.tick(deltaTime);

    // WebXR Hit-Test & Surface Reticle update
    this.arPlacement.update(deltaTime);

    // Smooth exponential damping towards anchored surface position
    const dampFactor = 1 - Math.exp(-10 * deltaTime);
    this.pet.position.lerp(this.targetPetPos, dampFactor);
    this.streakShrine.position.lerp(this.targetShrinePos, dampFactor);

    // Pet & Shrine animations + 3D HRTF Spatial Audio tracking
    const camera = xb.core.camera;
    this.pet.update(deltaTime, camera);
    this.streakShrine.update(deltaTime, camera);
    sound.updateSpatialPositions(this.pet.position, camera);

    // Mini-games update
    this.miniGames.update(deltaTime);

    // Sleep mode lighting effect with exponential damping
    const isSleeping = petManager.getState().isSleeping;
    const targetHemi = isSleeping ? 0.7 : 2.2;
    const targetDir = isSleeping ? 0.4 : 2.2;
    this.hemiLight.intensity = THREE.MathUtils.damp(this.hemiLight.intensity, targetHemi, 3.0, deltaTime);
    this.dirLight.intensity = THREE.MathUtils.damp(this.dirLight.intensity, targetDir, 3.0, deltaTime);
  }

  onSelectStart(event: xb.SelectEvent) {
    const target = event.target as THREE.Object3D | undefined;

    // 1. If in WebXR Hit-Test Surface Placement Mode and user selects a surface (not the UI card)
    if (
      this.arPlacement.isPlacementModeActive &&
      (!target || !this.isDescendantOf(target, this.spatialUI.card))
    ) {
      if (event.intersection && event.surface === xb.core.depth?.depthMesh) {
        this.anchorPetAtSurfacePoint(event.intersection.point);
        event.stopPropagation();
        return;
      } else if (this.arPlacement.hasValidSurfaceHit) {
        this.anchorPetAtSurfacePoint(this.arPlacement.lastHitPosition);
        event.stopPropagation();
        return;
      }
    }

    if (!target) return;

    // 2. Check if player clicked a falling berry during Berry Catch game
    if (this.miniGames.activeGame === 'berry_catch') {
      const caught = this.miniGames.catchBerryByMesh(target);
      if (caught) {
        event.stopPropagation();
        return;
      }
    }

    // 3. Check if player clicked the 3D Daily Streak Shrine
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

    // 4. Check if player clicked the Pet itself
    if (this.isDescendantOf(target, this.pet)) {
      petManager.pet();
      this.pet.spawnHearts(6);
      this.pet.triggerFlip();
      event.stopPropagation();
      return;
    }

    // 5. Check if player clicked a 3D Snack on the Snack Platter to Feed Pet
    const clickedSnack = this.snackPlatter.getSnackFromTarget(target);
    if (clickedSnack) {
      this.spatialUI.feedPet(clickedSnack);
      event.stopPropagation();
      return;
    }

    // 6. Check if player clicked the 3D Grooming Brush to Groom Pet
    if (this.isDescendantOf(target, this.groomingBrush)) {
      this.spatialUI.groomPet();
      event.stopPropagation();
      return;
    }

    // 7. Check if player clicked the Toy Ball
    if (this.isDescendantOf(target, this.bouncyBall)) {
      sound.playCatch(1);
      this.pet.spawnStars(4);
      petManager.recordDailyInteraction('Play Toy');
      petManager.gainExp(10);
      petManager.say('Yay, my favorite toy ball! 🎾 (+10 XP)', 3);
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

  dispose() {
    this.arPlacement.dispose();
    this.pet.dispose();
    this.streakShrine.dispose();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const options = new xb.Options();
  options.enableReticles();
  options.enableDepth();
  options.reticles.projectOnDepthMesh = true;
  options.enableXRTransitions();
  options.world.enablePlaneDetection();
  options.enableHands();
  options.hands.visualization = true;
  options.hands.visualizeJoints = true;

  options.setAppTitle('Tamagotchi XR');
  options.setAppDescription(
    'Virtual pet companion with AR Pass-Through, WebXR Hit-Test surface anchoring, 24-hour Daily Streak rewards, and real-time needs tracking.'
  );

  xb.add(new TamagotchiXRScene());
  xb.init(options);
});
