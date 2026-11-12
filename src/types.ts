export type PetSpecies = 'blobby' | 'pipsqueak' | 'draco' | 'kitsune';

export type PetColorId = 'pink' | 'mint' | 'purple' | 'gold' | 'blue' | 'sunset';

export type PetAccessory = 'none' | 'crown' | 'wizard' | 'sunglasses' | 'wings' | 'bowtie' | 'flower';

export type PetExpression = 'happy' | 'curious' | 'starry' | 'sleepy' | 'eating' | 'sad';

export type PetMood = 'ecstatic' | 'happy' | 'hungry' | 'sad' | 'distressed' | 'sleeping';

export type PetPersonality = 'Playful' | 'Sleepy' | 'Curious' | 'Affectionate' | 'Wise' | 'Hangry';

export interface PersonalityInfo {
  personality: PetPersonality;
  label: string;
  ageTitle: string;
  ageDaysFormatted: string;
  summary: string;
  cssColor: string;
  hexColor: number;
  iconEmoji: string;
}

export type EvolutionStage = 'baby' | 'child' | 'teen' | 'adult' | 'mystic';

export interface PetColorDef {
  id: PetColorId;
  name: string;
  primary: number;
  secondary: number;
  accent: number;
  glow: number;
}

export interface PetState {
  name: string;
  species: PetSpecies;
  colorId: PetColorId;
  accessory: PetAccessory;
  expression: PetExpression;
  hunger: number; // 0 (starving) to 100 (full)
  energy: number; // 0 (exhausted) to 100 (energetic)
  happiness: number; // 0 (depressed) to 100 (overjoyed)
  hygiene: number; // 0 (filthy) to 100 (sparkling clean)
  affection: number; // 0 to 9999
  experience: number;
  level: number;
  stage: EvolutionStage;
  ageHours: number;
  lastUpdateTimestamp: number;
  miniGameHighScore: number;
  dailyStreak: number;
  bestStreak: number;
  lastDailyDate: string;
  lastStreakInteractTimestamp: number;
  streakClaimedToday: boolean;
  totalDailyRewardsClaimed: number;
  isSleeping: boolean;
  totalGamesPlayed: number;
  totalFedCount: number;
  totalPetCount: number;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  petName: string;
  ownerName: string;
  species: PetSpecies;
  stage: EvolutionStage;
  level: number;
  happiness: number;
  affection: number;
  ageDays: number;
  isUser: boolean;
}

export type ActiveMiniGame = 'none' | 'berry_catch' | 'simon_dance';
