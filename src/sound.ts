/**
 * Procedural Audio Synthesizer for Tamagotchi XR.
 * Creates cute retro-modern chimes, bites, purrs, squeaks, and fanfares using Web Audio API.
 */
class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private getContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  /**
   * Cute pet chirp / squeak
   */
  public playChirp(pitchMultiplier: number = 1.0) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const startFreq = 480 * pitchMultiplier;
    const peakFreq = 880 * pitchMultiplier;
    const endFreq = 650 * pitchMultiplier;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(peakFreq, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.18);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Happy purr / double chirp when petted
   */
  public playHappy() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [0, 0.1].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      const baseFreq = (i === 0 ? 523.25 : 659.25) * 1.2; // C5, E5
      osc.frequency.setValueAtTime(baseFreq, now + delay);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + delay + 0.08);

      gain.gain.setValueAtTime(0.001, now + delay);
      gain.gain.linearRampToValueAtTime(0.18, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.16);
    });
  }

  /**
   * Crunch nom nom eating sound
   */
  public playEat() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Filtered noise pulse + low blip
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.06);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);

    // Second chew
    setTimeout(() => {
      const c = this.getContext();
      if (!c) return;
      const t = c.currentTime;
      const o2 = c.createOscillator();
      const g2 = c.createGain();
      o2.type = 'square';
      o2.frequency.setValueAtTime(280, t);
      o2.frequency.exponentialRampToValueAtTime(140, t + 0.07);
      g2.gain.setValueAtTime(0.14, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o2.connect(g2);
      g2.connect(c.destination);
      o2.start(t);
      o2.stop(t + 0.09);
    }, 110);
  }

  /**
   * Bubbly splash washing sound
   */
  public playSplash() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const f = 600 + Math.random() * 600;
      osc.frequency.setValueAtTime(f, now + i * 0.05);
      osc.frequency.exponentialRampToValueAtTime(f + 400, now + i * 0.05 + 0.08);

      gain.gain.setValueAtTime(0.001, now + i * 0.05);
      gain.gain.linearRampToValueAtTime(0.12, now + i * 0.05 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.12);
    }
  }

  /**
   * Lullaby sleep chime
   */
  public playSleep() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = [440, 392, 349.23, 261.63]; // A4, G4, F4, C4
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.2);

      gain.gain.setValueAtTime(0.001, now + idx * 0.2);
      gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.2 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.2 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.2);
      osc.stop(now + idx * 0.2 + 0.38);
    });
  }

  /**
   * Level up / evolution fanfare
   */
  public playLevelUp() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(0.001, now + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.1 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + (idx === 3 ? 0.6 : 0.25));

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.65);
    });
  }

  /**
   * UI Click / button press
   */
  public playClick() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Mini-game score catch chime
   */
  public playCatch(combo: number = 1) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const baseFreq = 500 + Math.min(combo * 60, 600);
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.4, now + 0.1);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * Simon game tone (0: left, 1: up, 2: right, 3: spin)
   */
  public playSimonTone(index: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const freqs = [329.63, 440.0, 554.37, 659.25]; // E4, A4, C#5, E5
    const freq = freqs[index % freqs.length];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }
}

export const sound = new SoundManager();
