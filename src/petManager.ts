import {
  EvolutionStage,
  LeaderboardEntry,
  PersonalityInfo,
  PetAccessory,
  PetColorDef,
  PetColorId,
  PetExpression,
  PetMood,
  PetPersonality,
  PetSpecies,
  PetState,
} from './types';
import { sound } from './sound';

export const PET_COLORS: Record<PetColorId, PetColorDef> = {
  pink: {
    id: 'pink',
    name: 'Sakura Pink',
    primary: 0xff85a2,
    secondary: 0xffb3c6,
    accent: 0xff4d79,
    glow: 0xffd1dc,
  },
  mint: {
    id: 'mint',
    name: 'Neon Mint',
    primary: 0x38ef7d,
    secondary: 0x8ef5b5,
    accent: 0x11998e,
    glow: 0xbbffdd,
  },
  purple: {
    id: 'purple',
    name: 'Cosmic Violet',
    primary: 0xa162e8,
    secondary: 0xc49df5,
    accent: 0x7b2cbf,
    glow: 0xdfccf9,
  },
  gold: {
    id: 'gold',
    name: 'Solar Golden',
    primary: 0xf6d365,
    secondary: 0xfda085,
    accent: 0xf39c12,
    glow: 0xfff0b3,
  },
  blue: {
    id: 'blue',
    name: 'Cyber Azure',
    primary: 0x48cae4,
    secondary: 0x90e0ef,
    accent: 0x0077b6,
    glow: 0xcaf0f8,
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset Coral',
    primary: 0xff6b6b,
    secondary: 0xffa07a,
    accent: 0xee5253,
    glow: 0xffccd2,
  },
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

export interface DailyStreakRewardSummary {
  day: number;
  title: string;
  expBonus: number;
  affectionBonus: number;
  happinessBonus: number;
  unlockedAccessory?: PetAccessory;
}

export const STREAK_TIERS: DailyStreakRewardSummary[] = [
  { day: 1, title: 'Day 1: Berry Treat', expBonus: 50, affectionBonus: 15, happinessBonus: 15 },
  { day: 2, title: 'Day 2: Cozy Blanket', expBonus: 75, affectionBonus: 25, happinessBonus: 20 },
  { day: 3, title: 'Day 3: Golden Apple', expBonus: 110, affectionBonus: 35, happinessBonus: 25, unlockedAccessory: 'flower' },
  { day: 4, title: 'Day 4: Starlight Elixir', expBonus: 150, affectionBonus: 50, happinessBonus: 30 },
  { day: 5, title: 'Day 5: Royal Sash', expBonus: 200, affectionBonus: 70, happinessBonus: 35, unlockedAccessory: 'bowtie' },
  { day: 6, title: 'Day 6: Astral Nectar', expBonus: 260, affectionBonus: 90, happinessBonus: 40 },
  { day: 7, title: 'Day 7: Mythic Chest 🏆', expBonus: 400, affectionBonus: 150, happinessBonus: 50, unlockedAccessory: 'wings' },
];

const DEFAULT_STATE: PetState = {
  name: 'Mochi',
  species: 'blobby',
  colorId: 'pink',
  accessory: 'crown',
  expression: 'happy',
  hunger: 80,
  energy: 90,
  happiness: 85,
  hygiene: 75,
  affection: 120,
  experience: 80,
  level: 3,
  stage: 'baby',
  ageHours: 4.5,
  lastUpdateTimestamp: Date.now(),
  miniGameHighScore: 420,
  dailyStreak: 2,
  bestStreak: 2,
  lastDailyDate: new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toDateString(),
  lastStreakInteractTimestamp: Date.now() - TWENTY_FOUR_HOURS_MS - 60000, // Ready for today's 24h interaction!
  streakClaimedToday: false,
  totalDailyRewardsClaimed: 2,
  isSleeping: false,
  totalGamesPlayed: 5,
  totalFedCount: 12,
  totalPetCount: 28,
};

const STORAGE_KEY = 'tamagotchi_xr_save_v1';

export class PetManager {
  private state: PetState;
  private listeners: Array<(state: PetState) => void> = [];
  private streakRewardListeners: Array<(reward: DailyStreakRewardSummary, newStreak: number) => void> = [];
  private feedListeners: Array<(snackType: 'apple' | 'cake' | 'sushi' | 'cookie', streakReward: DailyStreakRewardSummary | null) => void> = [];
  private groomListeners: Array<(streakReward: DailyStreakRewardSummary | null) => void> = [];
  private playListeners: Array<(streakReward: DailyStreakRewardSummary | null) => void> = [];
  private levelUpListeners: Array<(newLevel: number, stage: EvolutionStage) => void> = [];
  private xpGainListeners: Array<(amount: number, reason: string, leveledUp: boolean, newLevel: number) => void> = [];
  private speechBubbleText: string = 'Interact with me today to claim your Daily Streak reward! 🔥';
  private speechBubbleTimer: number = 0;
  private liveNotifyTimer: number = 0;

  constructor() {
    this.state = this.loadState();
    sound.setSpeciesVoice(this.state.species);
    this.applyTimeDeltaCatchup();
  }

  private loadState(): PetState {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        const merged: PetState = { ...DEFAULT_STATE, ...parsed };
        const req = this.getExpForNextLevel(merged.level);
        if (merged.experience >= req) {
          merged.experience = merged.experience % req;
        }
        return merged;
      }
    } catch {
      // Fallback
    }
    return { ...DEFAULT_STATE };
  }

  public saveState() {
    try {
      this.state.lastUpdateTimestamp = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore
    }
  }

  private applyTimeDeltaCatchup() {
    const now = Date.now();
    const elapsedSeconds = Math.max(0, (now - this.state.lastUpdateTimestamp) / 1000);
    // Don't over-punish if gone for weeks, cap at 12 hours
    const cappedSeconds = Math.min(elapsedSeconds, 12 * 3600);

    const decayPerHour = 7; // points per hour
    const decay = (cappedSeconds / 3600) * decayPerHour;

    this.state.ageHours += cappedSeconds / 3600;

    if (this.state.isSleeping) {
      // Restore energy while sleeping; hunger depletion is paused during sleep
      this.state.energy = Math.min(100, this.state.energy + (cappedSeconds / 3600) * 25);
      this.state.hygiene = Math.max(10, this.state.hygiene - decay * 0.2);
    } else {
      this.state.hunger = Math.max(5, this.state.hunger - decay);
      this.state.energy = Math.max(5, this.state.energy - decay * 0.8);
      this.state.happiness = Math.max(10, this.state.happiness - decay * 0.9);
      this.state.hygiene = Math.max(10, this.state.hygiene - decay * 0.7);
    }

    this.evaluateStreakWindow();
    this.recalculateStage();
    this.saveState();
  }

  /**
   * Evaluates whether the 24-hour cooldown has completed or if > 48 hours elapsed (streak reset).
   */
  public evaluateStreakWindow() {
    const now = Date.now();
    const elapsedSinceLastStreak = now - this.state.lastStreakInteractTimestamp;

    if (elapsedSinceLastStreak >= FORTY_EIGHT_HOURS_MS && this.state.dailyStreak > 0) {
      // More than 48 hours passed without interaction -> streak expired
      this.state.dailyStreak = 0;
      this.state.streakClaimedToday = false;
    } else if (elapsedSinceLastStreak >= TWENTY_FOUR_HOURS_MS) {
      // 24 hours have passed since last streak interaction -> eligible for next daily streak!
      this.state.streakClaimedToday = false;
    } else {
      this.state.streakClaimedToday = true;
    }
  }

  /**
   * Returns true if 24 hours have passed since the last rewarded daily interaction.
   */
  public isStreakRewardAvailable(): boolean {
    this.evaluateStreakWindow();
    return !this.state.streakClaimedToday;
  }

  /**
   * Returns remaining milliseconds until the next 24-hour streak window opens (0 if ready now).
   */
  public getMsUntilNextStreak(): number {
    const elapsed = Date.now() - this.state.lastStreakInteractTimestamp;
    return Math.max(0, TWENTY_FOUR_HOURS_MS - elapsed);
  }

  /**
   * Formats the countdown until the next 24-hour streak reward, or "READY NOW!"
   */
  public getStreakCountdownFormatted(): string {
    const remainingMs = this.getMsUntilNextStreak();
    if (remainingMs <= 0) {
      return 'READY NOW! Interact with pet 🔥';
    }
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `Next reward in ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  }

  /**
   * Gets the reward tier corresponding to a given streak day (cycles 1-7 with increasing multiplier).
   */
  public getRewardTierForDay(streakDay: number): DailyStreakRewardSummary {
    const cycleIndex = ((Math.max(1, streakDay) - 1) % 7);
    const weekMultiplier = Math.floor((Math.max(1, streakDay) - 1) / 7) + 1;
    const base = STREAK_TIERS[cycleIndex];
    return {
      ...base,
      expBonus: base.expBonus * weekMultiplier,
      affectionBonus: base.affectionBonus * weekMultiplier,
    };
  }

  public onStreakRewardClaimed(cb: (reward: DailyStreakRewardSummary, newStreak: number) => void): () => void {
    this.streakRewardListeners.push(cb);
    return () => {
      this.streakRewardListeners = this.streakRewardListeners.filter((l) => l !== cb);
    };
  }

  /**
   * Checks and awards the 24-hour Daily Streak reward when the user interacts with their pet
   * (feeding, petting, cleaning, playing mini-games, or clicking the 3D Daily Streak Shrine).
   */
  public recordDailyInteraction(sourceAction: string = 'care'): DailyStreakRewardSummary | null {
    this.evaluateStreakWindow();
    if (this.state.streakClaimedToday) {
      return null;
    }

    const now = Date.now();
    this.state.dailyStreak += 1;
    if (this.state.dailyStreak > this.state.bestStreak) {
      this.state.bestStreak = this.state.dailyStreak;
    }
    this.state.lastStreakInteractTimestamp = now;
    this.state.lastDailyDate = new Date(now).toDateString();
    this.state.streakClaimedToday = true;
    this.state.totalDailyRewardsClaimed += 1;

    const reward = this.getRewardTierForDay(this.state.dailyStreak);

    // Apply bonuses
    this.state.happiness = Math.min(100, this.state.happiness + reward.happinessBonus);
    this.state.hunger = Math.min(100, this.state.hunger + 15);
    this.state.energy = Math.min(100, this.state.energy + 15);
    this.state.affection += reward.affectionBonus;

    sound.playLevelUp();
    this.gainExp(reward.expBonus);

    const unlockMsg = reward.unlockedAccessory ? ` & Unlocked ${reward.unlockedAccessory.toUpperCase()}!` : '';
    this.say(
      `🔥 ${this.state.dailyStreak}-DAY STREAK! (${sourceAction}) +${reward.expBonus} XP, +${reward.affectionBonus} ❤️${unlockMsg}`,
      6.5
    );

    for (const listener of this.streakRewardListeners) {
      listener(reward, this.state.dailyStreak);
    }

    this.notify();
    return reward;
  }

  /**
   * Advances the internal 24h clock by 24 hours so users can test consecutive daily streak rewards immediately.
   */
  public simulateNext24Hours() {
    this.state.lastStreakInteractTimestamp = Date.now() - TWENTY_FOUR_HOURS_MS - 5000;
    this.state.streakClaimedToday = false;
    this.state.ageHours += 24;
    this.state.hunger = Math.max(25, this.state.hunger - 20);
    this.state.happiness = Math.max(35, this.state.happiness - 15);
    this.state.hygiene = Math.max(30, this.state.hygiene - 15);
    sound.playChirp(1.3);
    this.say('⏰ 24 Hours fast-forwarded! Interact with me or tap the Streak Shrine to claim your next Daily Streak! 🔥', 5);
    this.notify();
  }

  public subscribe(listener: (state: PetState) => void): () => void {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.saveState();
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  public getState(): PetState {
    return this.state;
  }

  public getSpeechBubble(): string {
    return this.speechBubbleText;
  }

  public say(text: string, durationSeconds: number = 4) {
    this.speechBubbleText = text;
    this.speechBubbleTimer = durationSeconds;
    this.notify();
  }

  /**
   * Called every frame/second to decay stats smoothly
   */
  public tick(deltaTimeSeconds: number) {
    // Smooth real-time decay so progress bars visibly update in real time
    const decayRate = deltaTimeSeconds * 0.35;

    if (this.state.isSleeping) {
      // While sleeping, hunger depletion is completely paused and energy gently restores
      this.state.energy = Math.min(100, this.state.energy + deltaTimeSeconds * 1.2);
      this.state.hygiene = Math.max(0, this.state.hygiene - decayRate * 0.15);
    } else {
      this.state.hunger = Math.max(0, this.state.hunger - decayRate);
      this.state.energy = Math.max(0, this.state.energy - decayRate * 0.5);
      this.state.happiness = Math.max(0, this.state.happiness - decayRate * 0.75);
      this.state.hygiene = Math.max(0, this.state.hygiene - decayRate * 0.4);
    }

    this.state.ageHours += deltaTimeSeconds / 3600;

    // Check if 24-hour window crossed while playing live
    if (this.state.streakClaimedToday && Date.now() - this.state.lastStreakInteractTimestamp >= TWENTY_FOUR_HOURS_MS) {
      this.state.streakClaimedToday = false;
      this.say('🔥 Your 24-Hour Daily Streak reward is ready! Pet or feed me to claim!', 5);
    }

    // Speech bubble auto timer
    if (this.speechBubbleTimer > 0) {
      this.speechBubbleTimer -= deltaTimeSeconds;
      if (this.speechBubbleTimer <= 0) {
        this.updateDefaultSpeechBubble();
      }
    }

    this.updateExpression();

    // Broadcast real-time stat updates 4 times per second for smooth progress bars
    this.liveNotifyTimer += deltaTimeSeconds;
    if (this.liveNotifyTimer >= 0.25) {
      this.liveNotifyTimer = 0;
      for (const listener of this.listeners) {
        listener(this.state);
      }
    }
  }

  private updateDefaultSpeechBubble() {
    if (!this.state.streakClaimedToday) {
      this.speechBubbleText = `🔥 Daily Streak Ready! Pet, feed, or tap the Shrine!`;
      return;
    }
    if (this.state.isSleeping) {
      this.speechBubbleText = 'Zzz... 💤 Dreaming of treats...';
      return;
    }
    if (this.state.hunger < 30) {
      this.speechBubbleText = "Tummy is rumbling! Feed me please! 🍎";
    } else if (this.state.hygiene < 30) {
      this.speechBubbleText = "I'm all dusty! Can I have a bath? 🧼";
    } else if (this.state.energy < 25) {
      this.speechBubbleText = "Yaaawn... feeling sleepy... 💤";
    } else if (this.state.happiness < 40) {
      this.speechBubbleText = "Let's play a mini-game together! 🎮";
    } else {
      const p = this.getPersonality();
      if (p === 'Curious') {
        this.speechBubbleText = `Ooh, what's that over there? Let's explore! 🔍`;
      } else if (p === 'Playful') {
        this.speechBubbleText = `Wheee! I have so much energy! Let's play! 🎾`;
      } else if (p === 'Wise') {
        this.speechBubbleText = `A calm mind and a warm heart... ✨`;
      } else if (p === 'Affectionate') {
        this.speechBubbleText = `I'm so happy being by your side! 💖`;
      } else if (p === 'Sleepy') {
        this.speechBubbleText = `*Blinks slowly...* Feeling cozy and drowsy... 💤`;
      } else {
        this.speechBubbleText = `Chirp! Pet me or play fetch! ✨`;
      }
    }
  }

  private updateExpression() {
    if (this.state.isSleeping) {
      this.state.expression = 'sleepy';
    } else if (this.state.hunger < 25 || this.state.happiness < 25) {
      this.state.expression = 'sad';
    } else if (this.state.happiness >= 80 && this.state.hunger >= 75) {
      this.state.expression = 'starry';
    } else if (this.state.hunger < 50 || this.state.happiness < 50) {
      this.state.expression = 'curious';
    } else {
      this.state.expression = 'happy';
    }
  }

  /**
   * Computes the pet's current visual mood state directly from `hunger` and `happiness`.
   */
  public getMood(): PetMood {
    if (this.state.isSleeping) {
      return 'sleeping';
    }
    const { hunger, happiness } = this.state;
    if (hunger < 25 || happiness < 25) {
      return 'distressed';
    }
    if (happiness >= 80 && hunger >= 75) {
      return 'ecstatic';
    }
    if (hunger < 50 && hunger <= happiness) {
      return 'hungry';
    }
    if (happiness < 50 && happiness < hunger) {
      return 'sad';
    }
    return 'happy';
  }

  /**
   * Returns structured visual styling & metadata for the current mood indicator.
   */
  public getMoodInfo(): {
    mood: PetMood;
    label: string;
    hexColor: number;
    accentHex: number;
    cssColor: string;
    iconEmoji: string;
    summary: string;
  } {
    const mood = this.getMood();
    const h = Math.round(this.state.hunger);
    const hap = Math.round(this.state.happiness);

    switch (mood) {
      case 'ecstatic':
        return {
          mood,
          label: 'ECSTATIC',
          hexColor: 0x06d6a0,
          accentHex: 0xffd166,
          cssColor: '#06d6a0',
          iconEmoji: '🤩',
          summary: `Radiant & Well-Fed (Hunger ${h}% | Happy ${hap}%)`,
        };
      case 'happy':
        return {
          mood,
          label: 'HAPPY',
          hexColor: 0x00f5d4,
          accentHex: 0x48cae4,
          cssColor: '#00f5d4',
          iconEmoji: '😊',
          summary: `Cheerful & Content (Hunger ${h}% | Happy ${hap}%)`,
        };
      case 'hungry':
        return {
          mood,
          label: 'HUNGRY',
          hexColor: 0xff9f1c,
          accentHex: 0xffbf69,
          cssColor: '#ff9f1c',
          iconEmoji: '🍎',
          summary: `Craving Snacks! (Hunger ${h}% | Happy ${hap}%)`,
        };
      case 'sad':
        return {
          mood,
          label: 'SAD',
          hexColor: 0x4ea8de,
          accentHex: 0x72efdd,
          cssColor: '#4ea8de',
          iconEmoji: '💧',
          summary: `Needs Play & Attention (Hunger ${h}% | Happy ${hap}%)`,
        };
      case 'distressed':
        return {
          mood,
          label: 'CRITICAL',
          hexColor: 0xff3366,
          accentHex: 0xff758f,
          cssColor: '#ff3366',
          iconEmoji: '⚠️',
          summary: `Urgent Care Needed! (Hunger ${h}% | Happy ${hap}%)`,
        };
      case 'sleeping':
        return {
          mood,
          label: 'SLEEPING',
          hexColor: 0xa162e8,
          accentHex: 0xc49df5,
          cssColor: '#c49df5',
          iconEmoji: '💤',
          summary: `Resting Peacefully (Hunger ${h}% | Happy ${hap}%)`,
        };
    }
  }

  /**
   * Allows testing specific hunger/happiness states to observe the 3D visual mood indicator transitions.
   */
  public applyMoodPreset(preset: 'ecstatic' | 'happy' | 'hungry' | 'sad' | 'distressed') {
    this.state.isSleeping = false;
    if (preset === 'ecstatic') {
      this.state.hunger = 95;
      this.state.happiness = 96;
      sound.playHappy();
      this.say('🤩 Feeling ECSTATIC! Full tummy and overflowing joy!', 4);
    } else if (preset === 'happy') {
      this.state.hunger = 70;
      this.state.happiness = 72;
      sound.playChirp(1.05);
      this.say('😊 Feeling Happy and balanced!', 4);
    } else if (preset === 'hungry') {
      this.state.hunger = 32;
      this.state.happiness = 68;
      sound.playChirp(0.82);
      this.say('🍎 Grrrble... My tummy is rumbling! Feed me a snack!', 4);
    } else if (preset === 'sad') {
      this.state.hunger = 72;
      this.state.happiness = 32;
      sound.playChirp(0.75);
      this.say('💧 Feeling lonely and blue... Cuddle or play with me!', 4);
    } else if (preset === 'distressed') {
      this.state.hunger = 18;
      this.state.happiness = 20;
      sound.playChirp(0.68);
      this.say('⚠️ Starving and sad! Please feed and cuddle me right away!', 4);
    }
    this.updateExpression();
    this.notify();
  }

  /**
   * Computes the pet's current Personality mood ('Playful', 'Sleepy', 'Curious', 'Affectionate', 'Wise', 'Hangry')
   * dynamically based on its current stats (energy, happiness, hunger, affection, isSleeping) and age (ageHours).
   */
  public getPersonality(): PetPersonality {
    const { hunger, happiness, energy, affection, ageHours, isSleeping, stage } = this.state;

    // 1. Sleepy: Currently sleeping, low energy (< 45%), or young baby (< 12h) with moderate-low energy (< 58%)
    if (isSleeping || energy < 45 || (ageHours < 12 && energy < 58)) {
      return 'Sleepy';
    }

    // 2. Hangry: Low hunger (< 38%) makes the pet restless and food-focused
    if (hunger < 38) {
      return 'Hangry';
    }

    // 3. Curious: Young pets (< 24h / < 1.0 day) exploring the world, or inquisitive moderate-happiness states
    if (
      (ageHours < 24 && happiness < 84 && energy >= 45) ||
      (happiness >= 42 && happiness < 74 && energy >= 52)
    ) {
      return 'Curious';
    }

    // 4. Wise: Mature / Elder pets (age >= 96h / 4.0+ days or adult/mystic stage) with balanced stats
    if ((ageHours >= 96 || stage === 'adult' || stage === 'mystic') && hunger >= 55 && happiness >= 68 && energy >= 50) {
      return 'Wise';
    }

    // 5. Playful: High energy (>= 68%) and joyful happiness (>= 74%), especially lively in youth/child/teen pets
    if (energy >= 68 && happiness >= 74) {
      return 'Playful';
    }

    // 6. Affectionate: High happiness & bond when calm
    if (happiness >= 70 && affection >= 110) {
      return 'Affectionate';
    }

    // Age-driven fallback
    if (ageHours < 24) return 'Curious';
    if (ageHours >= 96) return 'Wise';
    return 'Playful';
  }

  /**
   * Returns structured metadata and visual styling for the pet's current Personality mood & Age phase.
   */
  public getPersonalityInfo(): PersonalityInfo {
    const personality = this.getPersonality();
    const ageDays = this.state.ageHours / 24;
    const ageDaysFormatted = `${ageDays.toFixed(1)}d`;
    const e = Math.round(this.state.energy);
    const hap = Math.round(this.state.happiness);
    const h = Math.round(this.state.hunger);

    const ageTitle =
      ageDays < 1.0
        ? 'Young Sprout'
        : ageDays < 4.0
          ? 'Lively Youth'
          : 'Elder Sage';

    switch (personality) {
      case 'Playful':
        return {
          personality,
          label: 'PLAYFUL',
          ageTitle,
          ageDaysFormatted,
          summary: `${ageTitle} (${ageDaysFormatted}) | High Energy (${e}%) & Joy (${hap}%)`,
          cssColor: '#00f5d4',
          hexColor: 0x00f5d4,
          iconEmoji: '🎾',
        };
      case 'Sleepy':
        return {
          personality,
          label: 'SLEEPY',
          ageTitle,
          ageDaysFormatted,
          summary: `${ageTitle} (${ageDaysFormatted}) | Drowsy Energy (${e}%) - Needs Rest`,
          cssColor: '#c49df5',
          hexColor: 0xc49df5,
          iconEmoji: '💤',
        };
      case 'Curious':
        return {
          personality,
          label: 'CURIOUS',
          ageTitle,
          ageDaysFormatted,
          summary: `${ageTitle} (${ageDaysFormatted}) | Inquisitive Explorer (Age ${ageDaysFormatted}, Alert ${e}%)`,
          cssColor: '#38bdf8',
          hexColor: 0x38bdf8,
          iconEmoji: '🔍',
        };
      case 'Wise':
        return {
          personality,
          label: 'WISE',
          ageTitle,
          ageDaysFormatted,
          summary: `${ageTitle} (${ageDaysFormatted}) | Serene Mature Companion (Age ${ageDaysFormatted})`,
          cssColor: '#ffd166',
          hexColor: 0xffd166,
          iconEmoji: '✨',
        };
      case 'Affectionate':
        return {
          personality,
          label: 'AFFECTIONATE',
          ageTitle,
          ageDaysFormatted,
          summary: `${ageTitle} (${ageDaysFormatted}) | Devoted Bond (${this.state.affection} Affection)`,
          cssColor: '#ff85a2',
          hexColor: 0xff85a2,
          iconEmoji: '💖',
        };
      case 'Hangry':
        return {
          personality,
          label: 'HANGRY',
          ageTitle,
          ageDaysFormatted,
          summary: `${ageTitle} (${ageDaysFormatted}) | Craving Snacks (Hunger ${h}%)`,
          cssColor: '#ff9f1c',
          hexColor: 0xff9f1c,
          iconEmoji: '🍎',
        };
    }
  }

  /**
   * Adjusts stats and age to demonstrate a specific personality mood ('Playful', 'Sleepy', 'Curious', 'Wise', 'Affectionate').
   */
  public applyPersonalityPreset(preset: PetPersonality) {
    if (preset === 'Playful') {
      this.state.isSleeping = false;
      this.state.ageHours = 36; // 1.5 days (Lively Youth)
      this.state.energy = 92;
      this.state.happiness = 90;
      this.state.hunger = 85;
      sound.playHappy();
      this.say('🎾 Personality: PLAYFUL! (1.5d Youth, 92% Energy, 90% Happiness) Let’s bounce and play!', 4.5);
    } else if (preset === 'Sleepy') {
      this.state.isSleeping = false;
      this.state.energy = 28;
      this.state.happiness = 72;
      this.state.hunger = 75;
      sound.playChirp(0.78);
      this.say('💤 Personality: SLEEPY! (28% Energy) *Yaaawn* My eyelids are getting heavy...', 4.5);
    } else if (preset === 'Curious') {
      this.state.isSleeping = false;
      this.state.ageHours = 8; // 0.3 days (Young Sprout)
      this.state.energy = 78;
      this.state.happiness = 66;
      this.state.hunger = 76;
      sound.playChirp(1.18);
      this.say('🔍 Personality: CURIOUS! (0.3d Young Sprout) *Tilts head* Ooh, what is that over there?', 4.5);
    } else if (preset === 'Wise') {
      this.state.isSleeping = false;
      this.state.ageHours = 120; // 5.0 days (Elder Sage)
      this.state.energy = 80;
      this.state.happiness = 86;
      this.state.hunger = 84;
      sound.playChirp(0.95);
      this.say('✨ Personality: WISE! (5.0d Elder Sage) Serene, balanced, and full of ancient wisdom.', 4.5);
    } else if (preset === 'Affectionate') {
      this.state.isSleeping = false;
      this.state.ageHours = 54; // 2.3 days
      this.state.energy = 60;
      this.state.happiness = 88;
      this.state.hunger = 82;
      this.state.affection = Math.max(180, this.state.affection);
      sound.playHappy();
      this.say('💖 Personality: AFFECTIONATE! Deep bond and warm cuddles!', 4.5);
    } else if (preset === 'Hangry') {
      this.state.isSleeping = false;
      this.state.hunger = 26;
      this.state.energy = 70;
      this.state.happiness = 58;
      sound.playChirp(0.82);
      this.say('🍎 Personality: HANGRY! (26% Hunger) Feed me a treat right now please!', 4.5);
    }
    this.updateExpression();
    this.notify();
  }

  public onFeedPet(
    cb: (snackType: 'apple' | 'cake' | 'sushi' | 'cookie', streakReward: DailyStreakRewardSummary | null) => void
  ): () => void {
    this.feedListeners.push(cb);
    return () => {
      this.feedListeners = this.feedListeners.filter((l) => l !== cb);
    };
  }

  /**
   * Interactive 'Feed Pet' function that triggers the 3D feeding animation and multi-bite eating audio,
   * increases the pet's `hunger` variable (plus happiness & XP), and contributes to the 24-hour Daily Streak.
   */
  public feedPet(snackType?: 'apple' | 'cake' | 'sushi' | 'cookie'): DailyStreakRewardSummary | null {
    const snacks: Array<'apple' | 'cake' | 'sushi' | 'cookie'> = ['apple', 'cake', 'sushi', 'cookie'];
    const chosenSnack = snackType ?? snacks[Math.floor(Math.random() * snacks.length)];

    if (this.state.isSleeping) {
      this.state.isSleeping = false;
    }

    const boost =
      chosenSnack === 'cake' ? 35 : chosenSnack === 'sushi' ? 30 : chosenSnack === 'cookie' ? 20 : 25;
    const happyBoost = chosenSnack === 'cake' ? 20 : 12;

    const prevHunger = Math.round(this.state.hunger);
    this.state.hunger = Math.min(100, this.state.hunger + boost);
    const newHunger = Math.round(this.state.hunger);

    this.state.happiness = Math.min(100, this.state.happiness + happyBoost);
    this.state.hygiene = Math.max(0, this.state.hygiene - 3);
    this.state.affection += 6;
    this.state.totalFedCount += 1;
    this.state.expression = 'eating';

    // Trigger 3D spatial multi-bite eating sound effect
    sound.playEat(chosenSnack);
    const leveledUp = this.gainExp(25, `Fed ${chosenSnack.toUpperCase()}`);

    // Contribute to the 24-hour Daily Streak
    const streakReward = this.recordDailyInteraction(`Fed ${chosenSnack.toUpperCase()}`);
    if (!streakReward) {
      const gained = Math.max(0, newHunger - prevHunger);
      const hungerMsg = gained > 0 ? `+${gained}% Hunger (${newHunger}%)` : `Hunger Full (100%)`;
      const lvlPrefix = leveledUp ? `🎉 LEVEL UP TO LVL ${this.state.level}! ` : '';
      this.say(
        `${lvlPrefix}Nom nom nom! Ate ${chosenSnack.toUpperCase()}! 😋 ${hungerMsg}, +25 XP (${this.state.experience}/${this.getExpForNextLevel(this.state.level)} XP)`,
        4.5
      );
    }

    // Notify 3D PetRenderer to trigger the 3D feeding animation & food prop flight
    for (const listener of this.feedListeners) {
      listener(chosenSnack, streakReward);
    }

    setTimeout(() => {
      this.updateExpression();
      this.notify();
    }, 1800);

    this.notify();
    return streakReward;
  }

  public feed(snackType: 'apple' | 'cake' | 'sushi' | 'cookie') {
    this.feedPet(snackType);
  }

  public clean() {
    if (this.state.isSleeping) {
      this.say(`${this.state.name} is resting! 💤`);
      return;
    }
    this.state.hygiene = 100;
    this.state.happiness = Math.min(100, this.state.happiness + 15);
    this.state.affection += 8;

    sound.playSplash();
    const leveledUp = this.gainExp(20, 'Clean');

    const streakReward = this.recordDailyInteraction('Bubble Bath');
    if (!streakReward) {
      const lvlPrefix = leveledUp ? `🎉 LEVEL UP TO LVL ${this.state.level}! ` : '';
      this.say(`${lvlPrefix}Sparkling clean and squeaky fresh! ✨ (+20 XP)`);
    }
    this.notify();
  }

  public onGroomPet(cb: (streakReward: DailyStreakRewardSummary | null) => void): () => void {
    this.groomListeners.push(cb);
    return () => {
      this.groomListeners = this.groomListeners.filter((l) => l !== cb);
    };
  }

  /**
   * Interactive 'Groom Pet' function that triggers the 3D brushing animation,
   * plays a soothing brushing & purr audio clip, increases `happiness` (and hygiene),
   * awards +25 XP toward the next level, and contributes to the 24-hour Daily Streak.
   */
  public groomPet(): DailyStreakRewardSummary | null {
    if (this.state.isSleeping) {
      this.state.isSleeping = false;
    }

    const prevHappy = Math.round(this.state.happiness);
    this.state.happiness = Math.min(100, this.state.happiness + 22);
    const newHappy = Math.round(this.state.happiness);

    this.state.hygiene = Math.min(100, this.state.hygiene + 25);
    this.state.affection += 12;
    this.state.totalPetCount += 1;
    this.state.expression = 'starry';

    // Play soothing brushing + purr + harp shimmer audio
    sound.playGroom();
    const leveledUp = this.gainExp(25, 'Groom');

    const streakReward = this.recordDailyInteraction('Groomed Coat');
    if (!streakReward) {
      const gained = Math.max(0, newHappy - prevHappy);
      const happyMsg = gained > 0 ? `+${gained}% Happiness (${newHappy}%)` : `Happiness Max (100%)`;
      const lvlPrefix = leveledUp ? `🎉 LEVEL UP TO LVL ${this.state.level}! ` : '';
      this.say(
        `${lvlPrefix}*Purrrr...* Soothing brush strokes! ✨ ${happyMsg}, +25 XP (${this.state.experience}/${this.getExpForNextLevel(this.state.level)} XP)`,
        4.5
      );
    }

    // Notify 3D PetRenderer to trigger the 3D brushing animation
    for (const listener of this.groomListeners) {
      listener(streakReward);
    }

    setTimeout(() => {
      this.updateExpression();
      this.notify();
    }, 1750);

    this.notify();
    return streakReward;
  }

  public onPlayWithPet(cb: (streakReward: DailyStreakRewardSummary | null) => void): () => void {
    this.playListeners.push(cb);
    return () => {
      this.playListeners = this.playListeners.filter((l) => l !== cb);
    };
  }

  /**
   * Interactive 'Play with Pet' function that triggers playful bounce/flip animations,
   * plays joyful chirp & catch audio, increases `happiness` and XP (+30 XP),
   * and increments the pet's level when XP reaches threshold.
   */
  public playWithPet(activityLabel: string = 'Toy Ball'): DailyStreakRewardSummary | null {
    if (this.state.isSleeping) {
      this.state.isSleeping = false;
    }

    const prevHappy = Math.round(this.state.happiness);
    this.state.happiness = Math.min(100, this.state.happiness + 20);
    const newHappy = Math.round(this.state.happiness);

    this.state.energy = Math.max(10, this.state.energy - 4);
    this.state.affection += 10;
    this.state.totalGamesPlayed += 1;
    this.state.expression = 'starry';

    sound.playCatch(2);
    sound.playHappy();
    const leveledUp = this.gainExp(30, `Play (${activityLabel})`);

    const streakReward = this.recordDailyInteraction(`Played ${activityLabel}`);
    if (!streakReward) {
      const gained = Math.max(0, newHappy - prevHappy);
      const happyMsg = gained > 0 ? `+${gained}% Happiness (${newHappy}%)` : `Happiness Max (100%)`;
      const lvlPrefix = leveledUp ? `🎉 LEVEL UP TO LVL ${this.state.level}! ` : '';
      this.say(
        `${lvlPrefix}Yay, playing ${activityLabel} is so fun! 🎾 ${happyMsg}, +30 XP (${this.state.experience}/${this.getExpForNextLevel(this.state.level)} XP)`,
        4.5
      );
    }

    for (const listener of this.playListeners) {
      listener(streakReward);
    }

    setTimeout(() => {
      this.updateExpression();
      this.notify();
    }, 1500);

    this.notify();
    return streakReward;
  }

  public pet() {
    if (this.state.isSleeping) {
      this.say(`Soft purrs in their sleep... 💤`);
      sound.playHappy();
      return;
    }
    this.state.happiness = Math.min(100, this.state.happiness + 12);
    this.state.affection += 10;
    this.state.totalPetCount += 1;

    sound.playHappy();
    const leveledUp = this.gainExp(15, 'Pet');

    const streakReward = this.recordDailyInteraction('Cuddle');
    if (!streakReward) {
      const lvlPrefix = leveledUp ? `🎉 LEVEL UP TO LVL ${this.state.level}! ` : '';
      this.say(
        `${lvlPrefix}Purrr! That feels so nice! ❤️ +15 XP (${this.state.experience}/${this.getExpForNextLevel(this.state.level)} XP)`
      );
    }
    this.notify();
  }

  public toggleSleep() {
    if (this.state.isSleeping) {
      this.wakeUp();
    } else {
      this.putToSleep();
    }
  }

  public putToSleep() {
    this.state.isSleeping = true;
    this.state.expression = 'sleepy';
    sound.playSleep();
    const streakReward = this.recordDailyInteraction('Put to Sleep');
    if (!streakReward) {
      this.say(`🌙 Tucked in snugly! Hunger depletion paused while sleeping... Zzz 💤`, 4.5);
    }
    this.notify();
  }

  public wakeUp() {
    this.state.isSleeping = false;
    this.updateExpression();
    sound.playChirp(1.2);
    this.say(`☀️ Good morning! Rested & ready for an adventurous day!`, 4);
    this.notify();
  }

  public onLevelUp(cb: (newLevel: number, stage: EvolutionStage) => void): () => void {
    this.levelUpListeners.push(cb);
    return () => {
      this.levelUpListeners = this.levelUpListeners.filter((l) => l !== cb);
    };
  }

  public onXpGain(
    cb: (amount: number, reason: string, leveledUp: boolean, newLevel: number) => void
  ): () => void {
    this.xpGainListeners.push(cb);
    return () => {
      this.xpGainListeners = this.xpGainListeners.filter((l) => l !== cb);
    };
  }

  /**
   * Increases the pet's XP counter and increments the pet's level whenever enough XP is earned.
   */
  public gainExp(amount: number, reason: string = 'Interaction'): boolean {
    if (amount <= 0) return false;
    this.state.experience = Math.round(this.state.experience + amount);
    let leveledUp = false;

    while (this.state.experience >= this.getExpForNextLevel(this.state.level)) {
      const requiredForNext = this.getExpForNextLevel(this.state.level);
      this.state.experience -= requiredForNext;
      this.state.level += 1;
      leveledUp = true;
    }

    if (leveledUp) {
      sound.playLevelUp();
      this.say(`🎉 LEVEL UP! ${this.state.name} reached Level ${this.state.level}! 🎉`, 6);
      this.recalculateStage();
      for (const listener of this.levelUpListeners) {
        listener(this.state.level, this.state.stage);
      }
    }

    for (const listener of this.xpGainListeners) {
      listener(amount, reason, leveledUp, this.state.level);
    }

    this.notify();
    return leveledUp;
  }

  public getExpForNextLevel(_level: number = this.state.level): number {
    return 100;
  }

  public getXpProgress(): {
    currentXp: number;
    maxXp: number;
    percentage: number;
    level: number;
  } {
    const maxXp = this.getExpForNextLevel(this.state.level);
    const currentXp = Math.max(0, Math.min(maxXp, Math.round(this.state.experience)));
    const percentage = Math.max(0, Math.min(100, Math.round((currentXp / maxXp) * 100)));
    return {
      currentXp,
      maxXp,
      percentage,
      level: this.state.level,
    };
  }

  private recalculateStage() {
    const oldStage = this.state.stage;
    if (this.state.level >= 40) {
      this.state.stage = 'mystic';
    } else if (this.state.level >= 25) {
      this.state.stage = 'adult';
    } else if (this.state.level >= 12) {
      this.state.stage = 'teen';
    } else if (this.state.level >= 5) {
      this.state.stage = 'child';
    } else {
      this.state.stage = 'baby';
    }

    if (oldStage !== this.state.stage) {
      sound.playLevelUp();
      this.say(
        `✨ EVOLUTION! ${this.state.name} evolved into a ${this.state.stage.toUpperCase()} form! ✨`,
        7
      );
    }
  }

  public recordMiniGameResult(score: number, happinessBoost: number, expBonus: number) {
    this.state.happiness = Math.min(100, this.state.happiness + happinessBoost);
    this.state.energy = Math.max(5, this.state.energy - 10);
    this.state.hunger = Math.max(5, this.state.hunger - 8);
    this.state.totalGamesPlayed += 1;
    this.state.affection += Math.floor(score / 50);

    const streakReward = this.recordDailyInteraction('Mini-Game');

    if (score > this.state.miniGameHighScore) {
      this.state.miniGameHighScore = score;
      sound.playLevelUp();
      if (!streakReward) {
        this.say(`🏆 NEW HIGH SCORE: ${score}! Amazing playing! (+${expBonus} XP)`, 5);
      }
    } else {
      sound.playHappy();
      if (!streakReward) {
        this.say(`Great game! Scored ${score} pts! (+${expBonus} XP)`, 4);
      }
    }

    this.gainExp(expBonus);
    this.notify();
  }

  // Customization setters
  public setSpecies(species: PetSpecies) {
    this.state.species = species;
    sound.setSpeciesVoice(species);
    sound.playChirp(1.1);
    this.say(`Transformed into a ${species.toUpperCase()}! Look at me! ✨`);
    this.notify();
  }

  public setColor(colorId: PetColorId) {
    this.state.colorId = colorId;
    sound.playChirp(1.0);
    this.notify();
  }

  public setAccessory(accessory: PetAccessory) {
    this.state.accessory = accessory;
    sound.playHappy();
    this.say(`Equipped ${accessory === 'none' ? 'natural look' : accessory}! Stylish! 👑`);
    this.notify();
  }

  public setName(name: string) {
    if (!name.trim()) return;
    this.state.name = name.trim().slice(0, 14);
    this.notify();
  }

  /**
   * Generates dynamic social leaderboard comparing the user with worldwide pet owners
   */
  public getLeaderboard(): LeaderboardEntry[] {
    const userAgeDays = Math.max(1, Math.floor(this.state.ageHours / 24) + 1);

    const communityList: Omit<LeaderboardEntry, 'rank' | 'isUser'>[] = [
      {
        id: 'c1',
        petName: 'Aetherion',
        ownerName: 'StarlightXR',
        species: 'draco',
        stage: 'mystic',
        level: 52,
        happiness: 98,
        affection: 4890,
        ageDays: 64,
      },
      {
        id: 'c2',
        petName: 'Luna',
        ownerName: 'KyotoFox',
        species: 'kitsune',
        stage: 'mystic',
        level: 47,
        happiness: 95,
        affection: 3950,
        ageDays: 52,
      },
      {
        id: 'c3',
        petName: 'Boba',
        ownerName: 'PixelPanda',
        species: 'blobby',
        stage: 'adult',
        level: 38,
        happiness: 92,
        affection: 2780,
        ageDays: 39,
      },
      {
        id: 'c4',
        petName: 'Chirpy',
        ownerName: 'CloudWalker',
        species: 'pipsqueak',
        stage: 'adult',
        level: 31,
        happiness: 89,
        affection: 2150,
        ageDays: 31,
      },
      {
        id: 'c5',
        petName: 'Sparky',
        ownerName: 'AuraGamer',
        species: 'draco',
        stage: 'teen',
        level: 19,
        happiness: 88,
        affection: 1350,
        ageDays: 18,
      },
      {
        id: 'c6',
        petName: 'Yuki',
        ownerName: 'TokyoNeon',
        species: 'kitsune',
        stage: 'teen',
        level: 14,
        happiness: 82,
        affection: 980,
        ageDays: 12,
      },
      {
        id: 'c7',
        petName: 'Pudding',
        ownerName: 'WaffleHeart',
        species: 'blobby',
        stage: 'child',
        level: 8,
        happiness: 86,
        affection: 520,
        ageDays: 6,
      },
      {
        id: 'c8',
        petName: 'Pip',
        ownerName: 'NeoQuest',
        species: 'pipsqueak',
        stage: 'baby',
        level: 2,
        happiness: 74,
        affection: 110,
        ageDays: 1,
      },
    ];

    const userEntry: Omit<LeaderboardEntry, 'rank'> = {
      id: 'user_player',
      petName: this.state.name,
      ownerName: 'You (XR Pilot)',
      species: this.state.species,
      stage: this.state.stage,
      level: this.state.level,
      happiness: Math.round(this.state.happiness),
      affection: this.state.affection,
      ageDays: userAgeDays,
      isUser: true,
    };

    const combined = [...communityList.map((e) => ({ ...e, isUser: false })), userEntry];

    // Sort by level desc, then affection desc
    combined.sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return b.affection - a.affection;
    });

    return combined.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }
}

export const petManager = new PetManager();
