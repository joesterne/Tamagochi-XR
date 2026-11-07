import * as THREE from 'three';
import * as xb from 'xrblocks';
import { sound } from './sound';

// Pre-allocated math helpers for zero-GC updates
const _tempMatrix = new THREE.Matrix4();
const _tempPos = new THREE.Vector3();
const _tempQuat = new THREE.Quaternion();
const _tempScale = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _screenCenter = new THREE.Vector2(0, -0.15);

/**
 * Manages AR Pass-Through Mode, WebXR Hit-Test API (`requestHitTestSource`),
 * XR Blocks Depth/Plane surface intersection fallback, and the 3D Surface Anchor Reticle.
 */
export class ARPlacementSystem extends THREE.Group {
  public isPassThroughEnabled: boolean = true;
  public isPlacementModeActive: boolean = false;
  public hasValidSurfaceHit: boolean = false;
  public lastHitPosition: THREE.Vector3 = new THREE.Vector3(0, 0.85, -0.85);
  public lastHitQuaternion: THREE.Quaternion = new THREE.Quaternion();

  // WebXR Hit Test API state
  private hitTestSource: XRHitTestSource | null = null;
  private hitTestSourceRequested: boolean = false;
  private activeSession: XRSession | null = null;

  // Composite 3D Surface Reticle & Anchor Pad
  private reticleGroup: THREE.Group;
  private outerRingMesh: THREE.Mesh;
  private innerBeaconMesh: THREE.Mesh;
  private arrowIndicatorGroup: THREE.Group;
  private placedAnchorPad: THREE.Group;

  // Fallback virtual floor plane for desktop simulator / non-depth hit-testing
  public virtualFloorPlane: THREE.Mesh;

  private animTime: number = 0;
  private onStateChangeCallbacks: Array<() => void> = [];

  constructor() {
    super();
    this.name = 'ARPlacementSystem';

    // Invisible floor & table proxy for desktop simulator hit testing if depthMesh isn't hit
    const floorGeo = new THREE.PlaneGeometry(12, 12);
    const floorMat = new THREE.MeshBasicMaterial({
      visible: false,
      side: THREE.DoubleSide,
    });
    this.virtualFloorPlane = new THREE.Mesh(floorGeo, floorMat);
    this.virtualFloorPlane.rotation.x = -Math.PI / 2;
    this.virtualFloorPlane.position.y = 0.8;
    this.virtualFloorPlane.xb = { pointerEvents: 'none' };
    this.add(this.virtualFloorPlane);

    // Build Composite 3D Surface Target Reticle (5-part procedural group)
    this.reticleGroup = new THREE.Group();
    this.reticleGroup.visible = false;
    this.reticleGroup.xb = { pointerEvents: 'none' };
    this.add(this.reticleGroup);

    // Part 1: Outer glowing target ring
    const outerRingGeo = new THREE.RingGeometry(0.14, 0.175, 36);
    outerRingGeo.rotateX(-Math.PI / 2);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.outerRingMesh = new THREE.Mesh(outerRingGeo, outerRingMat);
    this.outerRingMesh.position.y = 0.005;
    this.reticleGroup.add(this.outerRingMesh);

    // Part 2: Inner dashed/compass ring (LatheGeometry beveled disc)
    const innerRingGeo = new THREE.RingGeometry(0.06, 0.085, 24);
    innerRingGeo.rotateX(-Math.PI / 2);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0xffd166,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.position.y = 0.008;
    this.reticleGroup.add(innerRing);

    // Part 3: Translucent Holographic Beacon Cylinder
    const beaconGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.16, 28, 1, true);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.innerBeaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    this.innerBeaconMesh.position.y = 0.085;
    this.reticleGroup.add(this.innerBeaconMesh);

    // Part 4 & 5: Downward Floating Pointer Cone + Gem
    this.arrowIndicatorGroup = new THREE.Group();
    this.arrowIndicatorGroup.position.y = 0.24;
    this.reticleGroup.add(this.arrowIndicatorGroup);

    const coneGeo = new THREE.ConeGeometry(0.045, 0.1, 16);
    coneGeo.rotateX(Math.PI);
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: 0xff9e00,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
    });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    this.arrowIndicatorGroup.add(coneMesh);

    const gemGeo = new THREE.OctahedronGeometry(0.028, 0);
    const gemMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4 });
    const gemMesh = new THREE.Mesh(gemGeo, gemMat);
    gemMesh.position.y = 0.085;
    this.arrowIndicatorGroup.add(gemMesh);

    // Build Grounded Physical Surface Anchor Pad (shown underneath anchored pet)
    this.placedAnchorPad = this.createPlacedAnchorPad();
    this.placedAnchorPad.position.set(0, 0.8, -0.85);
    this.add(this.placedAnchorPad);
  }

  private createPlacedAnchorPad(): THREE.Group {
    const padGroup = new THREE.Group();
    padGroup.xb = { pointerEvents: 'none' };

    // Turned beveled habitat coaster pad (LatheGeometry)
    const points = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.24, 0),
      new THREE.Vector2(0.25, 0.012),
      new THREE.Vector2(0.22, 0.022),
      new THREE.Vector2(0, 0.022),
    ];
    const baseGeo = new THREE.LatheGeometry(points, 32);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.6,
      metalness: 0.25,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.receiveShadow = true;
    padGroup.add(baseMesh);

    // Glowing gold/cyan rim torus
    const rimGeo = new THREE.TorusGeometry(0.23, 0.008, 12, 36);
    rimGeo.rotateX(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x00f5d4,
      emissive: 0x00bbf9,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.85,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.y = 0.02;
    padGroup.add(rimMesh);

    return padGroup;
  }

  public onStateChange(cb: () => void): () => void {
    this.onStateChangeCallbacks.push(cb);
    return () => {
      this.onStateChangeCallbacks = this.onStateChangeCallbacks.filter((c) => c !== cb);
    };
  }

  private notifyChange() {
    for (const cb of this.onStateChangeCallbacks) {
      cb();
    }
  }

  /**
   * Toggles between AR Pass-Through mode (transparent camera feed / real room)
   * and Immersive VR Sanctuary mode using XRTransition.
   */
  public toggleARPassThrough(): boolean {
    this.isPassThroughEnabled = !this.isPassThroughEnabled;
    sound.playClick();

    if (xb.core.transition) {
      if (this.isPassThroughEnabled) {
        xb.core.transition.toAR();
      } else {
        xb.core.transition.toVR({ color: 0x131826 });
      }
    } else if (xb.core.scene) {
      xb.core.scene.background = this.isPassThroughEnabled
        ? null
        : new THREE.Color(0x131826);
    }

    this.notifyChange();
    return this.isPassThroughEnabled;
  }

  /**
   * Toggles WebXR Hit-Test surface placement mode so the user can point and anchor their pet
   * onto any physical surface in their room.
   */
  public toggleSurfacePlacementMode(forceState?: boolean): boolean {
    this.isPlacementModeActive =
      forceState !== undefined ? forceState : !this.isPlacementModeActive;
    sound.playChirp(this.isPlacementModeActive ? 1.25 : 0.95);

    if (this.isPlacementModeActive && !this.isPassThroughEnabled) {
      // Automatically switch to AR Pass-Through when scanning real-world surfaces
      this.toggleARPassThrough();
    }

    if (!this.isPlacementModeActive) {
      this.reticleGroup.visible = false;
    }

    this.notifyChange();
    return this.isPlacementModeActive;
  }

  /**
   * Initializes the native WebXR Hit Test Source (`session.requestHitTestSource`)
   * when running on a WebXR AR device (Meta Quest, Android XR, etc.).
   */
  private ensureWebXRHitTestSource() {
    const renderer = xb.core.renderer;
    if (!(renderer instanceof THREE.WebGLRenderer) || !renderer.xr.isPresenting) {
      return;
    }

    const session = renderer.xr.getSession();
    if (!session) return;

    if (this.activeSession !== session) {
      this.activeSession = session;
      this.hitTestSource = null;
      this.hitTestSourceRequested = false;

      session.addEventListener('end', () => {
        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
        this.activeSession = null;
      });
    }

    if (!this.hitTestSourceRequested && typeof session.requestHitTestSource === 'function') {
      this.hitTestSourceRequested = true;
      session
        .requestReferenceSpace('viewer')
        .then((viewerSpace) => {
          if (session.requestHitTestSource) {
            return session.requestHitTestSource({ space: viewerSpace });
          }
          return null;
        })
        .then((source) => {
          if (source) {
            this.hitTestSource = source;
          }
        })
        .catch(() => {
          // Device or session doesn't support hit-test; DepthMesh / Plane raycast fallback is used
        });
    }
  }

  /**
   * Updates hit-test intersection every frame using:
   * 1. Native WebXR `frame.getHitTestResults(this.hitTestSource)`
   * 2. XR Blocks `xb.core.depth.depthMesh` raycast intersection
   * 3. Virtual horizontal surface intersection for desktop simulator preview
   */
  public update(deltaTime: number) {
    this.animTime += deltaTime;

    if (!this.isPlacementModeActive) {
      this.reticleGroup.visible = false;
      return;
    }

    this.ensureWebXRHitTestSource();

    let hitFound = false;

    // 1. Try Native WebXR Hit-Test API
    const frame = xb.core.currentFrame;
    const renderer = xb.core.renderer;
    if (
      frame &&
      this.hitTestSource &&
      renderer instanceof THREE.WebGLRenderer &&
      renderer.xr.isPresenting
    ) {
      const referenceSpace = renderer.xr.getReferenceSpace();
      if (referenceSpace) {
        const hitTestResults = frame.getHitTestResults(this.hitTestSource);
        if (hitTestResults.length > 0) {
          const hit = hitTestResults[0];
          const pose = hit.getPose(referenceSpace);
          if (pose) {
            _tempMatrix.fromArray(pose.transform.matrix);
            _tempMatrix.decompose(_tempPos, _tempQuat, _tempScale);
            this.lastHitPosition.copy(_tempPos);
            this.lastHitQuaternion.copy(_tempQuat);
            hitFound = true;
          }
        }
      }
    }

    // 2. Try XR Blocks DepthMesh intersection (`xb.core.depth.depthMesh`)
    if (!hitFound && xb.core.depth?.depthMesh && xb.core.user) {
      const depthHit = xb.core.user.getIntersectionAt(xb.core.depth.depthMesh);
      if (depthHit) {
        this.lastHitPosition.copy(depthHit.point);
        this.lastHitQuaternion.identity();
        hitFound = true;
      }
    }

    // 3. Fallback to camera forward raycast against virtual floor/table surface (Simulator)
    if (!hitFound && xb.core.camera) {
      _raycaster.setFromCamera(_screenCenter, xb.core.camera);
      const intersects = _raycaster.intersectObject(this.virtualFloorPlane, false);
      if (intersects.length > 0 && intersects[0].distance < 4.5) {
        this.lastHitPosition.copy(intersects[0].point);
        this.lastHitQuaternion.identity();
        hitFound = true;
      }
    }

    this.hasValidSurfaceHit = hitFound;
    this.reticleGroup.visible = hitFound;

    if (hitFound) {
      // Smooth exponential damping for surface reticle
      this.reticleGroup.position.lerp(this.lastHitPosition, 1 - Math.exp(-18 * deltaTime));
      this.reticleGroup.quaternion.slerp(this.lastHitQuaternion, 1 - Math.exp(-18 * deltaTime));

      // Animate reticle rings & pointer cone
      this.outerRingMesh.rotation.y = this.animTime * 1.5;
      this.arrowIndicatorGroup.position.y = 0.22 + Math.sin(this.animTime * 5.0) * 0.035;
      this.arrowIndicatorGroup.rotation.y = this.animTime * 2.5;
    }
  }

  /**
   * Moves the grounded anchor coaster pad to the newly anchored surface coordinates.
   */
  public setAnchoredPose(position: THREE.Vector3, quaternion?: THREE.Quaternion) {
    this.placedAnchorPad.position.copy(position);
    if (quaternion) {
      this.placedAnchorPad.quaternion.copy(quaternion);
    }
  }

  public getAnchoredPosition(): THREE.Vector3 {
    return this.placedAnchorPad.position;
  }

  public dispose() {
    if (this.hitTestSource) {
      this.hitTestSource.cancel();
      this.hitTestSource = null;
    }
  }
}
