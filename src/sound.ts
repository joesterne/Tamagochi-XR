import * as THREE from 'three';

/**
 * Spatial & Procedural Audio Engine for Tamagotchi XR.
 * Synthesizes 3D spatialized sound effects (HRTF PannerNode), species-distinct voices,
 * multi-bite eating crunches, playful chirps, purrs, splashes, lullabies, and ambient soundscapes
 * using the Web Audio API with zero external audio file dependencies.
 */
class SpatialAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private petPanner: PannerNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private isMuted: boolean = false;
  private masterVolume: number = 0.85;
  private isAmbientEnabled: boolean = false;
  private ambientTimer: number | null = null;
  private userInteracted: boolean = false;

  // Species pitch & timbre profiles
  private currentSpecies: 'blobby' | 'pipsqueak' | 'draco' | 'kitsune' = 'blobby';

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.userInteracted = true;
        const ctx = this.getContext();
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
      window.addEventListener('click', unlock, { passive: true });
      window.addEventListener('touchstart', unlock, { passive: true });
    }
  }

  private getContext(): AudioContext | null {
    if (this.isMuted || !this.userInteracted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 1.0;
      this.sfxGain.connect(this.masterGain);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.18;
      this.ambientGain.connect(this.masterGain);

      // 3D HRTF Spatial Panner for the virtual pet's world position
      this.petPanner = this.ctx.createPanner();
      this.petPanner.panningModel = 'HRTF';
      this.petPanner.distanceModel = 'inverse';
      this.petPanner.refDistance = 0.8;
      this.petPanner.maxDistance = 10.0;
      this.petPanner.rolloffFactor = 1.2;
      this.petPanner.positionX.value = 0;
      this.petPanner.positionY.value = 1.0;
      this.petPanner.positionZ.value = -0.85;
      this.petPanner.connect(this.sfxGain);

      this.createNoiseBuffer();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Generates a reusable 1-second white/pink noise buffer for realistic crunches, splashes, and purrs.
   */
  private createNoiseBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 1.0;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  /**
   * Updates 3D spatial audio listener (headset/camera pose) and pet emitter coordinates each frame.
   */
  public updateSpatialPositions(petPosition: THREE.Vector3, camera?: THREE.Camera) {
    if (!this.ctx || !this.petPanner) return;
    const now = this.ctx.currentTime;

    this.petPanner.positionX.setTargetAtTime(petPosition.x, now, 0.02);
    this.petPanner.positionY.setTargetAtTime(petPosition.y, now, 0.02);
    this.petPanner.positionZ.setTargetAtTime(petPosition.z, now, 0.02);

    if (camera && this.ctx.listener) {
      const listener = this.ctx.listener;
      if (listener.positionX) {
        listener.positionX.setTargetAtTime(camera.position.x, now, 0.02);
        listener.positionY.setTargetAtTime(camera.position.y, now, 0.02);
        listener.positionZ.setTargetAtTime(camera.position.z, now, 0.02);
      }
    }
  }

  public setSpeciesVoice(species: 'blobby' | 'pipsqueak' | 'draco' | 'kitsune') {
    this.currentSpecies = species;
  }

  private getSpeciesPitchMultiplier(): number {
    switch (this.currentSpecies) {
      case 'pipsqueak':
        return 1.32; // High songbird chirp
      case 'blobby':
        return 1.05; // Bouncy cute jelly tone
      case 'kitsune':
        return 1.15; // Mystical fox chime
      case 'draco':
        return 0.82; // Deeper baby dragon trill
      default:
        return 1.0;
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : this.masterVolume,
        this.ctx.currentTime,
        0.03
      );
    }
  }

  public isAudioMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.userInteracted = true;
    this.setMuted(!this.isMuted);
    if (!this.isMuted) {
      this.playClick();
    }
    return this.isMuted;
  }

  public setVolume(volume0to100: number) {
    this.userInteracted = true;
    this.masterVolume = Math.max(0, Math.min(1, volume0to100 / 100));
    const ctx = this.getContext();
    if (ctx && this.masterGain && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, ctx.currentTime, 0.02);
    }
  }

  public getVolumePercent(): number {
    return Math.round(this.masterVolume * 100);
  }

  /**
   * Toggles a gentle, procedural XR sanctuary ambient soundscape (soft wind chimes & warm pad).
   */
  public toggleAmbientSoundscape(): boolean {
    this.userInteracted = true;
    this.isAmbientEnabled = !this.isAmbientEnabled;
    if (this.isAmbientEnabled) {
      this.startAmbientLoop();
    } else {
      this.stopAmbientLoop();
    }
    return this.isAmbientEnabled;
  }

  public isAmbientPlaying(): boolean {
    return this.isAmbientEnabled;
  }

  private startAmbientLoop() {
    this.stopAmbientLoop();
    this.playAmbientChord();
    this.ambientTimer = window.setInterval(() => {
      if (this.isAmbientEnabled && !this.isMuted) {
        this.playAmbientChord();
      }
    }, 3600);
  }

  private stopAmbientLoop() {
    if (this.ambientTimer !== null) {
      clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
  }

  private playAmbientChord() {
    const ctx = this.getContext();
    if (!ctx || !this.ambientGain) return;
    const now = ctx.currentTime;

    // Pentatonic sanctuary chime notes
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 659.25];
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const freq = scale[Math.floor(Math.random() * scale.length)];
      osc.frequency.setValueAtTime(freq, now + i * 0.8);

      gain.gain.setValueAtTime(0.0001, now + i * 0.8);
      gain.gain.linearRampToValueAtTime(0.09, now + i * 0.8 + 0.6);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.8 + 3.2);

      osc.connect(gain);
      gain.connect(this.ambientGain);
      osc.start(now + i * 0.8);
      osc.stop(now + i * 0.8 + 3.3);
    }
  }

  private getPetOutputNode(ctx: AudioContext): AudioNode {
    return this.petPanner || this.sfxGain || ctx.destination;
  }

  /**
   * Playful pet chirp / squeak with species-specific pitch & vibrato.
   */
  public playChirp(pitchMultiplier: number = 1.0) {
    this.userInteracted = true;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.getPetOutputNode(ctx);

    const speciesMult = this.getSpeciesPitchMultiplier() * pitchMultiplier;
    const osc = ctx.createOscillator();
    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = this.currentSpecies === 'draco' ? 'triangle' : 'sine';
    const startFreq = 480 * speciesMult;
    const peakFreq = 920 * speciesMult;
    const endFreq = 680 * speciesMult;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(peakFreq, now + 0.075);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.16);
    osc.frequency.exponentialRampToValueAtTime(peakFreq * 1.08, now + 0.23);

    vibrato.frequency.value = 26;
    vibratoGain.gain.value = 18 * speciesMult;
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    vibrato.start(now);
    osc.stop(now + 0.27);
    vibrato.stop(now + 0.27);
  }

  /**
   * Affectionate cuddle purr + melodic double-chirp when petting the virtual companion.
   */
  public playHappy() {
    this.userInteracted = true;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.getPetOutputNode(ctx);
    const speciesMult = this.getSpeciesPitchMultiplier();

    // 1. Warm amplitude-modulated purr rumble
    const purrOsc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const purrGain = ctx.createGain();

    purrOsc.type = 'triangle';
    purrOsc.frequency.setValueAtTime(145 * speciesMult, now);
    purrOsc.frequency.linearRampToValueAtTime(185 * speciesMult, now + 0.35);

    lfo.frequency.value = 24; // 24Hz purr flutter
    lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain);
    lfoGain.connect(purrGain.gain);

    purrGain.gain.setValueAtTime(0.08, now);
    purrGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    purrOsc.connect(purrGain);
    purrGain.connect(dest);
    purrOsc.start(now);
    lfo.start(now);
    purrOsc.stop(now + 0.4);
    lfo.stop(now + 0.4);

    // 2. Melodic arpeggio chirp
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((baseFreq, i) => {
      const delay = i * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const freq = baseFreq * speciesMult;
      osc.frequency.setValueAtTime(freq, now + delay);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + delay + 0.07);

      gain.gain.setValueAtTime(0.001, now + delay);
      gain.gain.linearRampToValueAtTime(0.2, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.14);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now + delay);
      osc.stop(now + delay + 0.15);
    });
  }

  /**
   * Multi-bite crispy eating sound ("Nom-nom-crunch-gulp!") using filtered noise bursts + tonal chews.
   */
  public playEat(snackType: 'apple' | 'cake' | 'sushi' | 'cookie' = 'apple') {
    this.userInteracted = true;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.getPetOutputNode(ctx);
    const speciesMult = this.getSpeciesPitchMultiplier();

    // Filter cutoff based on food crispness (apple/cookie = crispier, cake/sushi = softer chew)
    const isCrispy = snackType === 'apple' || snackType === 'cookie';
    const filterFreq = isCrispy ? 1600 : 850;

    // 3 rhythmic bites
    [0, 0.13, 0.26].forEach((delay, biteIdx) => {
      // Filtered noise crunch
      if (this.noiseBuffer) {
        const noise = ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(filterFreq + biteIdx * 220, now + delay);
        filter.Q.value = 2.2;

        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.001, now + delay);
        nGain.gain.linearRampToValueAtTime(0.28, now + delay + 0.015);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.09);

        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(dest);

        noise.start(now + delay);
        noise.stop(now + delay + 0.1);
      }

      // Tonal "nom" pitch inflection
      const osc = ctx.createOscillator();
      const oGain = ctx.createGain();
      osc.type = 'triangle';
      const baseF = (240 + biteIdx * 35) * speciesMult;
      osc.frequency.setValueAtTime(baseF, now + delay);
      osc.frequency.exponentialRampToValueAtTime(baseF * 0.55, now + delay + 0.08);

      oGain.gain.setValueAtTime(0.18, now + delay);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.09);

      osc.connect(oGain);
      oGain.connect(dest);
      osc.start(now + delay);
      osc.stop(now + delay + 0.095);
    });

    // Happy satisfied "Yum!" squeak after chewing
    const yumDelay = 0.42;
    const yumOsc = ctx.createOscillator();
    const yumGain = ctx.createGain();
    yumOsc.type = 'sine';
    yumOsc.frequency.setValueAtTime(520 * speciesMult, now + yumDelay);
    yumOsc.frequency.exponentialRampToValueAtTime(880 * speciesMult, now + yumDelay + 0.12);

    yumGain.gain.setValueAtTime(0.001, now + yumDelay);
    yumGain.gain.linearRampToValueAtTime(0.2, now + yumDelay + 0.03);
    yumGain.gain.exponentialRampToValueAtTime(0.001, now + yumDelay + 0.18);

    yumOsc.connect(yumGain);
    yumGain.connect(dest);
    yumOsc.start(now + yumDelay);
    yumOsc.stop(now + yumDelay + 0.19);
  }

  /**
   * Bubbly soap scrub & water pop sound effects during cleaning.
   */
  public playSplash() {
    this.userInteracted = true;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.getPetOutputNode(ctx);

    // 5 rising bubble pops
    for (let i = 0; i < 5; i++) {
      const delay = i * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const f = 520 + i * 140 + Math.random() * 180;
      osc.frequency.setValueAtTime(f, now + delay);
      osc.frequency.exponentialRampToValueAtTime(f * 1.65, now + delay + 0.075);

      gain.gain.setValueAtTime(0.001, now + delay);
      gain.gain.linearRampToValueAtTime(0.16, now + delay + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.09);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now + delay);
      osc.stop(now + delay + 0.1);
    }
  }

  /**
   * Soothing multi-stroke brushing sound + warm purr + gentle harp shimmer when grooming the pet.
   */
  public playGroom() {
    this.userInteracted = true;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.getPetOutputNode(ctx);
    const speciesMult = this.getSpeciesPitchMultiplier();

    // 1. 4 gentle rhythmic brushing strokes (soft bandpass-filtered noise sweeps)
    [0, 0.34, 0.68, 1.02].forEach((delay, strokeIdx) => {
      if (this.noiseBuffer) {
        const noise = ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        const startF = strokeIdx % 2 === 0 ? 750 : 950;
        const endF = strokeIdx % 2 === 0 ? 1280 : 680;
        filter.frequency.setValueAtTime(startF, now + delay);
        filter.frequency.exponentialRampToValueAtTime(endF, now + delay + 0.24);
        filter.Q.value = 1.5;

        const brushGain = ctx.createGain();
        brushGain.gain.setValueAtTime(0.001, now + delay);
        brushGain.gain.linearRampToValueAtTime(0.14, now + delay + 0.08);
        brushGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.26);

        noise.connect(filter);
        filter.connect(brushGain);
        brushGain.connect(dest);

        noise.start(now + delay);
        noise.stop(now + delay + 0.28);
      }
    });

    // 2. Warm continuous soothing purr undertone
    const purrOsc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const purrGain = ctx.createGain();

    purrOsc.type = 'sine';
    purrOsc.frequency.setValueAtTime(135 * speciesMult, now);
    purrOsc.frequency.linearRampToValueAtTime(168 * speciesMult, now + 0.7);
    purrOsc.frequency.linearRampToValueAtTime(142 * speciesMult, now + 1.35);

    lfo.frequency.value = 21; // 21Hz soothing purr flutter
    lfoGain.gain.value = 0.045;
    lfo.connect(lfoGain);
    lfoGain.connect(purrGain.gain);

    purrGain.gain.setValueAtTime(0.001, now);
    purrGain.gain.linearRampToValueAtTime(0.085, now + 0.2);
    purrGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

    purrOsc.connect(purrGain);
    purrGain.connect(dest);
    purrOsc.start(now);
    lfo.start(now);
    purrOsc.stop(now + 1.45);
    lfo.stop(now + 1.45);

    // 3. Soothing pentatonic harp / chime arpeggio
    const soothingNotes = [523.25, 659.25, 783.99, 987.77, 1174.66]; // C5, E5, G5, B5, D6 (Cmaj9)
    soothingNotes.forEach((freq, idx) => {
      const delay = 0.12 + idx * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);

      gain.gain.setValueAtTime(0.001, now + delay);
      gain.gain.linearRampToValueAtTime(0.11, now + delay + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.55);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now + delay);
      osc.stop(now + delay + 0.58);
    });
  }

  /**
   * Lullaby music-box chime when tucking the pet in for a nap.
   */
  public playSleep() {
    this.userInteracted = true;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.getPetOutputNode(ctx);

    const notes = [523.25, 493.88, 392.0, 329.63, 261.63]; // C5, B4, G4, E4, C4
    notes.forEach((freq, idx) => {
      const delay = idx * 0.16;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);

      gain.gain.setValueAtTime(0.001, now + delay);
      gain.gain.linearRampToValueAtTime(0.16, now + delay + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.42);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now + delay);
      osc.stop(now + delay + 0.45);
    });
  }

  /**
   * Level up / evolution / Daily Streak celebration fanfare.
   */
  public playLevelUp() {
    this.userInteracted = true;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.getPetOutputNode(ctx);

    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5, E5, G5, C6, E6
    notes.forEach((freq, idx) => {
      const delay = idx * 0.085;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + delay);

      gain.gain.setValueAtTime(0.001, now + delay);
      gain.gain.linearRampToValueAtTime(0.24, now + delay + 0.025);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + delay + (idx === notes.length - 1 ? 0.55 : 0.22)
      );

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now + delay);
      osc.stop(now + delay + 0.6);
    });
  }

  /**
   * Crisp UI button click.
   */
  public playClick() {
    this.userInteracted = true;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(840, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.035);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.sfxGain || ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Mini-game score catch chime with combo pitch escalation.
   */
  public playCatch(combo: number = 1) {
    this.userInteracted = true;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.getPetOutputNode(ctx);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const baseFreq = 520 + Math.min(combo * 55, 650);
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.45, now + 0.11);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * Simon Dance tone (0: left hop, 1: jump, 2: right hop, 3: 360 spin).
   */
  public playSimonTone(index: number) {
    this.userInteracted = true;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.getPetOutputNode(ctx);

    const freqs = [329.63, 440.0, 554.37, 659.25]; // E4, A4, C#5, E5
    const freq = freqs[index % freqs.length];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.32);
  }
}

export const sound = new SpatialAudioEngine();
