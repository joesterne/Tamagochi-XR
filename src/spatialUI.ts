import * as xb from 'xrblocks';
import { PetAccessory, PetColorId, PetSpecies, PetState } from './types';
import { PET_COLORS, STREAK_TIERS, petManager } from './petManager';
import { sound } from './sound';
import { MiniGameManager } from './miniGames';
import { PetRenderer } from './petRenderer';
import { DailyStreakShrine } from './streakShrine';
import { ARPlacementSystem } from './arPlacement';

export class TamagotchiSpatialUI {
  public card: xb.UICard;
  public overlay: xb.UIOverlay;
  private petRef: PetRenderer;
  private miniGames: MiniGameManager;
  private streakShrineRef?: DailyStreakShrine;
  private arPlacementRef?: ARPlacementSystem;

  // On-Screen XR Viewport Overlay Elements (xb.UIOverlay)
  private overlayPetTitleText!: xb.UIText;
  private overlayMoodBadgeText!: xb.UIText;
  private overlayHungerText!: xb.UIText;
  private overlayHungerBar!: xb.UIPanel;
  private overlayHappinessText!: xb.UIText;
  private overlayHappinessBar!: xb.UIPanel;
  private overlayXpText!: xb.UIText;
  private overlayXpBar!: xb.UIPanel;
  private overlaySleepBtn!: xb.UIButton;

  // On-Screen 2D DOM HUD Overlay Elements
  private domNightVeilEl?: HTMLElement;
  private domHudContainer?: HTMLElement;
  private domPetNameEl?: HTMLElement;
  private domPetLevelEl?: HTMLElement;
  private domPetPersonalityEl?: HTMLElement;
  private domPetMoodEl?: HTMLElement;
  private domHungerFillEl?: HTMLElement;
  private domHungerValueEl?: HTMLElement;
  private domHungerStateEl?: HTMLElement;
  private domHappinessFillEl?: HTMLElement;
  private domHappinessValueEl?: HTMLElement;
  private domHappinessStateEl?: HTMLElement;
  private domXpFillEl?: HTMLElement;
  private domXpValueEl?: HTMLElement;
  private domXpStateEl?: HTMLElement;
  private domSleepBtnEl?: HTMLButtonElement;
  private xpFeedbackTimer?: number;

  // Active Tab: 'care' | 'streak' | 'stylist' | 'games' | 'leaderboard'
  private currentTab: 'care' | 'streak' | 'stylist' | 'games' | 'leaderboard' = 'care';

  // Header Elements
  private titleText: xb.UIText;
  private subtitleText: xb.UIText;
  private levelBadgeText: xb.UIText;

  // AR Pass-Through & Hit-Test Placement Bar Elements
  private arModeToggleBtn: xb.UIButton;
  private surfaceAnchorBtn: xb.UIButton;
  private arStatusText: xb.UIText;

  // Spatial Audio Engine Controls
  private sfxToggleBtn: xb.UIButton;
  private ambientToggleBtn: xb.UIButton;
  private chirpVoiceBtn: xb.UIButton;

  // Tab Buttons
  private tabCareBtn: xb.UIButton;
  private tabStreakBtn: xb.UIButton;
  private tabStylistBtn: xb.UIButton;
  private tabGamesBtn: xb.UIButton;
  private tabLeaderboardBtn: xb.UIButton;

  // Tab Containers
  private carePanel: xb.UIPanel;
  private streakPanel: xb.UIPanel;
  private stylistPanel: xb.UIPanel;
  private gamesPanel: xb.UIPanel;
  private leaderboardPanel: xb.UIPanel;

  // Care Panel Elements
  private moodStatusBadgePanel: xb.UIPanel;
  private moodStatusText: xb.UIText;
  private xpText: xb.UIText;
  private xpBar: xb.UIPanel;
  private hungerText: xb.UIText;
  private hungerBar: xb.UIPanel;
  private energyText: xb.UIText;
  private energyBar: xb.UIPanel;
  private happinessText: xb.UIText;
  private happinessBar: xb.UIPanel;
  private hygieneText: xb.UIText;
  private hygieneBar: xb.UIPanel;
  private sleepBtn: xb.UIButton;

  // Streak Panel Elements
  private streakHeaderTitle: xb.UIText;
  private streakCountdownText: xb.UIText;
  private streakRewardTierText: xb.UIText;
  private streakCalendarRow1: xb.UIPanel;
  private streakCalendarRow2: xb.UIPanel;
  private claimDailyRewardBtn: xb.UIButton;

  // Stylist Panel Elements
  private speciesText: xb.UIText;
  private colorText: xb.UIText;
  private accessoryText: xb.UIText;

  // Games Panel Elements
  private gameStatusText: xb.UIText;
  private gameScoreText: xb.UIText;
  private simonControlsPanel: xb.UIPanel;

  // Leaderboard Panel Elements
  private leaderboardListPanel: xb.UIPanel;

  constructor(
    pet: PetRenderer,
    miniGames: MiniGameManager,
    streakShrine?: DailyStreakShrine,
    arPlacement?: ARPlacementSystem
  ) {
    this.petRef = pet;
    this.miniGames = miniGames;
    this.streakShrineRef = streakShrine;
    this.arPlacementRef = arPlacement;

    // Header elements (ASCII-clean for zero MSDF missing-glyph warnings)
    this.titleText = new xb.UIText({
      text: 'Mochi (BABY)',
      style: { fontSize: 25, fontWeight: 'bold', color: '#ffffff' },
    });
    this.subtitleText = new xb.UIText({
      text: 'Age: 0.2 days | Daily Streak: 2d',
      style: { fontSize: 13, opacity: 0.78, color: '#e0e7ff' },
    });
    this.levelBadgeText = new xb.UIText({
      text: 'LVL 3',
      style: { fontSize: 16, fontWeight: 'bold', color: '#ffd166' },
    });

    const header = new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 4,
      },
      children: [
        new xb.UIPanel({
          style: { flexDirection: 'column', gap: 2 },
          children: [this.titleText, this.subtitleText],
        }),
        new xb.UIPanel({
          style: {
            backgroundColor: 'rgba(255, 209, 102, 0.15)',
            borderColor: '#ffd166',
            borderWidth: 1.5,
            borderRadius: 12,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
          },
          children: [this.levelBadgeText],
        }),
      ],
    });

    // --- AR Pass-Through & WebXR Hit-Test Surface Anchor Controls ---
    this.arModeToggleBtn = new xb.UIButton({
      label: 'AR Pass-Through: ON',
      icon: 'view_in_ar',
      style: { flexGrow: 1, height: 36, fontSize: 12 },
      onClick: () => {
        if (!this.arPlacementRef) return;
        const isAR = this.arPlacementRef.toggleARPassThrough();
        petManager.say(
          isAR
            ? 'AR Pass-Through Active! Your real room is visible!'
            : 'Switched to Cozy VR Sanctuary Environment!',
          3.5
        );
        this.refreshARControlsUI();
      },
    });

    this.surfaceAnchorBtn = new xb.UIButton({
      label: 'Anchor to Surface',
      icon: 'open_with',
      style: { flexGrow: 1, height: 36, fontSize: 12 },
      onClick: () => {
        if (!this.arPlacementRef) return;
        const active = this.arPlacementRef.toggleSurfacePlacementMode();
        if (active) {
          petManager.say(
            'Point at any physical surface & pinch/click to anchor me there!',
            5
          );
        } else {
          petManager.say('Surface placement locked!', 3);
        }
        this.refreshARControlsUI();
      },
    });

    this.arStatusText = new xb.UIText({
      text: 'AR Pass-Through Ready | Use Hit-Test to anchor pet onto real surfaces',
      style: { fontSize: 11, opacity: 0.78, color: '#00f5d4', textAlign: 'center' },
    });

    const arControlBar = new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'column',
        gap: 6,
        padding: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 245, 212, 0.08)',
        borderColor: 'rgba(0, 245, 212, 0.25)',
        borderWidth: 1,
      },
      children: [
        new xb.UIPanel({
          style: { width: '100%', flexDirection: 'row', gap: 8 },
          children: [this.arModeToggleBtn, this.surfaceAnchorBtn],
        }),
        this.arStatusText,
      ],
    });

    if (this.arPlacementRef) {
      this.arPlacementRef.onStateChange(() => this.refreshARControlsUI());
    }

    // --- 3D Spatial Audio Engine Controls ---
    this.sfxToggleBtn = new xb.UIButton({
      label: 'SFX: ON',
      icon: 'volume_up',
      style: { flexGrow: 1, height: 34, fontSize: 12 },
      onClick: () => {
        const isOn = sound.toggleMute();
        this.sfxToggleBtn.label = isOn ? 'SFX: ON' : 'SFX: MUTED';
        this.sfxToggleBtn.icon = isOn ? 'volume_up' : 'volume_off';
        if (isOn) {
          petManager.say('3D Spatial Pet Audio Enabled! 🔊', 3);
        } else {
          this.ambientToggleBtn.label = 'Chimes: OFF';
        }
      },
    });

    this.ambientToggleBtn = new xb.UIButton({
      label: 'Chimes: OFF',
      icon: 'music_note',
      style: { flexGrow: 1, height: 34, fontSize: 12 },
      onClick: () => {
        const active = sound.toggleAmbientSoundscape();
        this.ambientToggleBtn.label = active ? 'Chimes: ON' : 'Chimes: OFF';
        if (active) {
          this.sfxToggleBtn.label = 'SFX: ON';
          this.sfxToggleBtn.icon = 'volume_up';
          petManager.say('Sanctuary Wind Chimes playing softly! 🎐', 3);
        }
      },
    });

    this.chirpVoiceBtn = new xb.UIButton({
      label: 'Chirp!',
      icon: 'favorite',
      style: { flexGrow: 1, height: 34, fontSize: 12 },
      onClick: () => {
        sound.playChirp(0.95 + Math.random() * 0.25);
        this.petRef.spawnHearts(4);
        this.petRef.spawnStars(3);
        const state = petManager.getState();
        petManager.say(
          `*Playful ${state.species.toUpperCase()} chirp!* My voice adapts to my species! 🎵`,
          3.5
        );
      },
    });

    const audioControlRow = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 6 },
      children: [this.sfxToggleBtn, this.ambientToggleBtn, this.chirpVoiceBtn],
    });

    // Tab buttons
    this.tabCareBtn = new xb.UIButton({
      label: 'Care',
      icon: 'favorite',
      style: { flexGrow: 1, height: 38, fontSize: 13 },
      onClick: () => this.switchTab('care'),
    });
    this.tabStreakBtn = new xb.UIButton({
      label: 'Streak',
      style: { flexGrow: 1, height: 38, fontSize: 13 },
      onClick: () => this.switchTab('streak'),
    });
    this.tabStylistBtn = new xb.UIButton({
      label: 'Stylist',
      icon: 'palette',
      style: { flexGrow: 1, height: 38, fontSize: 13 },
      onClick: () => this.switchTab('stylist'),
    });
    this.tabGamesBtn = new xb.UIButton({
      label: 'Games',
      icon: 'sports_esports',
      style: { flexGrow: 1, height: 38, fontSize: 13 },
      onClick: () => this.switchTab('games'),
    });
    this.tabLeaderboardBtn = new xb.UIButton({
      label: 'Rank',
      icon: 'leaderboard',
      style: { flexGrow: 1, height: 38, fontSize: 13 },
      onClick: () => this.switchTab('leaderboard'),
    });

    const tabRow = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 6 },
      children: [
        this.tabCareBtn,
        this.tabStreakBtn,
        this.tabStylistBtn,
        this.tabGamesBtn,
        this.tabLeaderboardBtn,
      ],
    });

    // --- Care Panel Setup ---
    this.moodStatusText = new xb.UIText({
      text: 'MOOD: ECSTATIC - Radiant & Well-Fed (Hunger 80% | Happy 85%)',
      style: { fontSize: 12, fontWeight: 'bold', color: '#06d6a0', textAlign: 'center' },
    });

    this.moodStatusBadgePanel = new xb.UIPanel({
      style: {
        width: '100%',
        padding: 8,
        borderRadius: 10,
        backgroundColor: 'rgba(6, 214, 160, 0.14)',
        borderColor: '#06d6a0',
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
      },
      children: [this.moodStatusText],
    });

    this.xpText = new xb.UIText({
      text: '80 / 100 XP',
      style: { fontSize: 13, fontWeight: 'bold', color: '#ffd166' },
    });
    this.xpBar = new xb.UIPanel({
      style: { width: '80%', height: '100%', backgroundColor: '#ffd166', borderRadius: 6 },
    });

    this.hungerText = new xb.UIText({ text: '80%', style: { fontSize: 13, fontWeight: 'bold' } });
    this.hungerBar = new xb.UIPanel({
      style: { width: '80%', height: '100%', backgroundColor: '#ff5c8a', borderRadius: 6 },
    });

    this.energyText = new xb.UIText({ text: '90%', style: { fontSize: 13, fontWeight: 'bold' } });
    this.energyBar = new xb.UIPanel({
      style: { width: '90%', height: '100%', backgroundColor: '#ffd166', borderRadius: 6 },
    });

    this.happinessText = new xb.UIText({ text: '85%', style: { fontSize: 13, fontWeight: 'bold' } });
    this.happinessBar = new xb.UIPanel({
      style: { width: '85%', height: '100%', backgroundColor: '#06d6a0', borderRadius: 6 },
    });

    this.hygieneText = new xb.UIText({ text: '75%', style: { fontSize: 13, fontWeight: 'bold' } });
    this.hygieneBar = new xb.UIPanel({
      style: { width: '75%', height: '100%', backgroundColor: '#118ab2', borderRadius: 6 },
    });

    const needsContainer = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'column', gap: 8 },
      children: [
        this.createNeedRow('XP (Level)', this.xpBar, this.xpText),
        this.createNeedRow('Hunger', this.hungerBar, this.hungerText),
        this.createNeedRow('Energy', this.energyBar, this.energyText),
        this.createNeedRow('Happiness', this.happinessBar, this.happinessText),
        this.createNeedRow('Hygiene', this.hygieneBar, this.hygieneText),
      ],
    });

    this.sleepBtn = new xb.UIButton({
      label: 'Put to Sleep',
      icon: 'bedtime',
      style: { flexGrow: 1, height: 42 },
      onClick: () => {
        this.toggleSleepPet();
      },
    });

    const careRow1 = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 8 },
      children: [
        new xb.UIButton({
          label: 'Feed (+25 XP)',
          icon: 'restaurant',
          style: { flexGrow: 1, height: 42 },
          onClick: () => {
            this.feedPet();
          },
        }),
        new xb.UIButton({
          label: 'Groom (+25 XP)',
          icon: 'favorite',
          style: { flexGrow: 1, height: 42 },
          onClick: () => {
            this.groomPet();
          },
        }),
        new xb.UIButton({
          label: 'Play (+30 XP)',
          icon: 'sports_esports',
          style: { flexGrow: 1, height: 42 },
          onClick: () => {
            this.playWithPet('Toy Ball');
          },
        }),
      ],
    });

    const snackSelectRow = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 6 },
      children: [
        this.createMiniBtn('Apple +25%', () => this.feedPet('apple')),
        this.createMiniBtn('Cake +35%', () => this.feedPet('cake')),
        this.createMiniBtn('Sushi +30%', () => this.feedPet('sushi')),
        this.createMiniBtn('Cookie +20%', () => this.feedPet('cookie')),
      ],
    });

    const careRow2 = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 8 },
      children: [
        new xb.UIButton({
          label: 'Pet / Cuddle',
          icon: 'favorite',
          style: { flexGrow: 1, height: 42 },
          onClick: () => {
            petManager.pet();
            this.petRef.spawnHearts(8);
            this.petRef.triggerFlip();
            this.refreshStreakPanelUI();
          },
        }),
        new xb.UIButton({
          label: 'Bubble Clean',
          icon: 'soap',
          style: { flexGrow: 1, height: 42 },
          onClick: () => {
            petManager.clean();
            this.petRef.spawnBubbles(10);
            this.refreshStreakPanelUI();
          },
        }),
        this.sleepBtn,
      ],
    });

    const personalityPresetRow = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 6 },
      children: [
        this.createMiniBtn('Trait: Playful', () => {
          petManager.applyPersonalityPreset('Playful');
          this.petRef.spawnStars(6);
          this.petRef.triggerFlip();
        }),
        this.createMiniBtn('Trait: Sleepy', () => {
          petManager.applyPersonalityPreset('Sleepy');
        }),
        this.createMiniBtn('Trait: Curious', () => {
          petManager.applyPersonalityPreset('Curious');
          this.petRef.spawnBubbles(5);
        }),
        this.createMiniBtn('Trait: Wise', () => {
          petManager.applyPersonalityPreset('Wise');
          this.petRef.spawnStars(8);
        }),
      ],
    });

    const moodPresetRow = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 6 },
      children: [
        this.createMiniBtn('Mood: Ecstatic', () => {
          petManager.applyMoodPreset('ecstatic');
          this.petRef.spawnStars(6);
        }),
        this.createMiniBtn('Mood: Hungry', () => {
          petManager.applyMoodPreset('hungry');
        }),
        this.createMiniBtn('Mood: Sad', () => {
          petManager.applyMoodPreset('sad');
        }),
        this.createMiniBtn('Mood: Critical', () => {
          petManager.applyMoodPreset('distressed');
        }),
      ],
    });

    this.carePanel = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'column', gap: 8 },
      children: [
        this.moodStatusBadgePanel,
        needsContainer,
        careRow1,
        snackSelectRow,
        careRow2,
        personalityPresetRow,
        moodPresetRow,
      ],
    });

    // --- Daily Streak Panel Setup ---
    this.streakHeaderTitle = new xb.UIText({
      text: '2 Day Streak | Best: 2 Days',
      style: { fontSize: 18, fontWeight: 'bold', color: '#ffd166', textAlign: 'center' },
    });

    this.streakCountdownText = new xb.UIText({
      text: 'READY NOW! Interact with pet',
      style: { fontSize: 14, fontWeight: 'bold', color: '#00f5d4', textAlign: 'center' },
    });

    this.streakRewardTierText = new xb.UIText({
      text: 'Next Milestone: Day 3 Golden Apple (+110 XP, +35 Affection, Flower Crown)',
      style: { fontSize: 12, opacity: 0.85, textAlign: 'center', color: '#ffffff' },
    });

    this.streakCalendarRow1 = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 6 },
      children: [],
    });

    this.streakCalendarRow2 = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 6 },
      children: [],
    });

    this.claimDailyRewardBtn = new xb.UIButton({
      label: 'Claim 24h Streak Reward',
      style: { flexGrow: 1, height: 42 },
      onClick: () => {
        const reward = petManager.recordDailyInteraction('Daily Check-In');
        if (reward) {
          this.petRef.spawnStars(12);
          this.petRef.spawnHearts(8);
          this.petRef.triggerFlip();
          this.streakShrineRef?.triggerCelebrationBurst();
        } else {
          sound.playChirp(0.9);
          petManager.say(`Already claimed today! ${petManager.getStreakCountdownFormatted()}`, 4);
        }
        this.refreshStreakPanelUI();
      },
    });

    const simulate24hBtn = new xb.UIButton({
      label: '+24h Fast-Forward',
      style: { flexGrow: 1, height: 42 },
      onClick: () => {
        petManager.simulateNext24Hours();
        this.streakShrineRef?.syncWithStreakState();
        this.refreshStreakPanelUI();
      },
    });

    const streakActionRow = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 8 },
      children: [this.claimDailyRewardBtn, simulate24hBtn],
    });

    this.streakPanel = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'column', gap: 10, display: 'none' },
      children: [
        this.streakHeaderTitle,
        this.streakCountdownText,
        this.streakRewardTierText,
        this.streakCalendarRow1,
        this.streakCalendarRow2,
        streakActionRow,
      ],
    });

    // --- Stylist Panel Setup ---
    this.speciesText = new xb.UIText({
      text: 'Current: Blobby',
      style: { fontSize: 14, fontWeight: 'bold', color: '#00f5d4' },
    });
    this.colorText = new xb.UIText({
      text: 'Color: Sakura Pink',
      style: { fontSize: 14, fontWeight: 'bold', color: '#ff85a2' },
    });
    this.accessoryText = new xb.UIText({
      text: 'Accessory: Crown',
      style: { fontSize: 14, fontWeight: 'bold', color: '#ffd166' },
    });

    // Species Buttons
    const speciesRow = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 6 },
      children: [
        this.createMiniBtn('Blobby', () => this.selectSpecies('blobby')),
        this.createMiniBtn('Pipsqueak', () => this.selectSpecies('pipsqueak')),
        this.createMiniBtn('Draco', () => this.selectSpecies('draco')),
        this.createMiniBtn('Kitsune', () => this.selectSpecies('kitsune')),
      ],
    });

    // Colors Row
    const colorRow1 = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 6 },
      children: [
        this.createMiniBtn('Pink', () => this.selectColor('pink')),
        this.createMiniBtn('Mint', () => this.selectColor('mint')),
        this.createMiniBtn('Purple', () => this.selectColor('purple')),
      ],
    });
    const colorRow2 = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 6 },
      children: [
        this.createMiniBtn('Gold', () => this.selectColor('gold')),
        this.createMiniBtn('Blue', () => this.selectColor('blue')),
        this.createMiniBtn('Sunset', () => this.selectColor('sunset')),
      ],
    });

    // Accessory Row
    const accessoryRow1 = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 6 },
      children: [
        this.createMiniBtn('None', () => this.selectAccessory('none')),
        this.createMiniBtn('Crown', () => this.selectAccessory('crown')),
        this.createMiniBtn('Wizard', () => this.selectAccessory('wizard')),
        this.createMiniBtn('Glasses', () => this.selectAccessory('sunglasses')),
      ],
    });
    const accessoryRow2 = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 6 },
      children: [
        this.createMiniBtn('Wings', () => this.selectAccessory('wings')),
        this.createMiniBtn('Bowtie', () => this.selectAccessory('bowtie')),
        this.createMiniBtn('Flower', () => this.selectAccessory('flower')),
      ],
    });

    this.stylistPanel = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'column', gap: 8, display: 'none' },
      children: [
        new xb.UIText({ text: 'Species Archetype', style: { fontSize: 13, opacity: 0.7 } }),
        this.speciesText,
        speciesRow,
        new xb.UIText({ text: 'Coat Color Tone', style: { fontSize: 13, opacity: 0.7 } }),
        this.colorText,
        colorRow1,
        colorRow2,
        new xb.UIText({ text: 'Hats & Gear', style: { fontSize: 13, opacity: 0.7 } }),
        this.accessoryText,
        accessoryRow1,
        accessoryRow2,
      ],
    });

    // --- Games Panel Setup ---
    this.gameStatusText = new xb.UIText({
      text: 'Select a daily game to boost happiness & earn EXP!',
      style: { fontSize: 14, lineHeight: 1.35, textAlign: 'center', opacity: 0.8 },
    });
    this.gameScoreText = new xb.UIText({
      text: `Personal Best: ${petManager.getState().miniGameHighScore} pts`,
      style: { fontSize: 15, fontWeight: 'bold', color: '#ffd166', textAlign: 'center' },
    });

    // Simon Buttons
    this.simonControlsPanel = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 8, display: 'none' },
      children: [
        new xb.UIButton({
          label: 'Left Hop',
          style: { flexGrow: 1, height: 44, backgroundColor: '#3a86ff' },
          onClick: () => this.miniGames.handlePlayerSimonInput(0),
        }),
        new xb.UIButton({
          label: 'High Jump',
          style: { flexGrow: 1, height: 44, backgroundColor: '#ff006e' },
          onClick: () => this.miniGames.handlePlayerSimonInput(1),
        }),
        new xb.UIButton({
          label: 'Right Hop',
          style: { flexGrow: 1, height: 44, backgroundColor: '#fb5607' },
          onClick: () => this.miniGames.handlePlayerSimonInput(2),
        }),
        new xb.UIButton({
          label: '360 Spin',
          style: { flexGrow: 1, height: 44, backgroundColor: '#8338ec' },
          onClick: () => this.miniGames.handlePlayerSimonInput(3),
        }),
      ],
    });

    const gamesLaunchRow = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 10 },
      children: [
        new xb.UIButton({
          label: 'Berry Drop',
          icon: 'play_arrow',
          style: { flexGrow: 1, height: 44 },
          onClick: () => this.startBerryDropGame(),
        }),
        new xb.UIButton({
          label: 'Simon Dance',
          icon: 'music_note',
          style: { flexGrow: 1, height: 44 },
          onClick: () => this.startSimonDanceGame(),
        }),
      ],
    });

    this.gamesPanel = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'column', gap: 12, display: 'none' },
      children: [this.gameStatusText, this.gameScoreText, gamesLaunchRow, this.simonControlsPanel],
    });

    // --- Leaderboard Panel Setup ---
    this.leaderboardListPanel = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'column', gap: 6 },
      children: [],
    });

    this.leaderboardPanel = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'column', gap: 10, display: 'none' },
      children: [
        new xb.UIText({
          text: 'Global Pet Growth Rankings',
          style: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', color: '#ffd166' },
        }),
        new xb.UIText({
          text: 'Ranked by Growth Level, Evolution Stage & Days Alive',
          style: { fontSize: 12, opacity: 0.65, textAlign: 'center' },
        }),
        this.leaderboardListPanel,
      ],
    });

    // Main Card
    this.card = new xb.UICard({
      size: { width: 0.72, height: 'auto' },
      manipulation: true,
      edge: true,
      style: {
        flexDirection: 'column',
        gap: 14,
        padding: 18,
        backgroundColor: 'rgba(15, 20, 32, 0.88)',
        borderColor: 'rgba(255, 255, 255, 0.18)',
        borderWidth: 1.5,
        borderRadius: 20,
      },
      children: [
        header,
        arControlBar,
        audioControlRow,
        tabRow,
        this.carePanel,
        this.streakPanel,
        this.stylistPanel,
        this.gamesPanel,
        this.leaderboardPanel,
      ],
    });

    // Initial position in XR
    this.card.position.set(0, 1.45, -1.05);

    // Build On-Screen XR Viewport UIOverlay & 2D DOM HUD Overlay
    this.overlay = this.buildOnScreenXROverlay();
    this.buildOnScreenDomHudOverlay();

    // Subscribe to state updates & XP/Level-Up events
    petManager.subscribe((state) => this.onStateChanged(state));
    petManager.onXpGain((amount, _reason, leveledUp, newLevel) => {
      this.triggerHudXpFeedback(amount, leveledUp, newLevel);
    });
    this.refreshStreakPanelUI();
    this.refreshARControlsUI();
  }

  /**
   * Triggers visual pulse feedback on the HUD XP counter and Level badge when XP is earned or level increments.
   */
  private triggerHudXpFeedback(amount: number, leveledUp: boolean, newLevel: number) {
    if (this.domXpStateEl) {
      this.domXpStateEl.textContent = leveledUp ? `LEVEL UP! LVL ${newLevel}!` : `+${amount} XP!`;
      this.domXpStateEl.classList.add('xp-gain-highlight');
    }
    if (leveledUp && this.domPetLevelEl) {
      this.domPetLevelEl.classList.remove('level-up-pulse');
      void this.domPetLevelEl.offsetWidth;
      this.domPetLevelEl.classList.add('level-up-pulse');
    }
    if (this.xpFeedbackTimer) {
      window.clearTimeout(this.xpFeedbackTimer);
    }
    this.xpFeedbackTimer = window.setTimeout(() => {
      if (this.domXpStateEl) {
        this.domXpStateEl.classList.remove('xp-gain-highlight');
        const prog = petManager.getXpProgress();
        this.domXpStateEl.textContent = `Next: LVL ${prog.level + 1}`;
      }
    }, 2200);
  }

  /**
   * Creates an on-screen XR Blocks `xb.UIOverlay` anchored to the bottom of the viewport
   * that displays the pet's live 'hunger', 'happiness', and 'XP / Level' stats as real-time progress bars.
   */
  private buildOnScreenXROverlay(): xb.UIOverlay {
    this.overlayPetTitleText = new xb.UIText({
      text: 'MOCHI (BABY) - LVL 3 (80/100 XP)',
      pointerEvents: 'none',
      style: { fontSize: 15, fontWeight: 'bold', color: '#ffffff' },
    });

    this.overlayMoodBadgeText = new xb.UIText({
      text: 'MOOD: ECSTATIC',
      pointerEvents: 'none',
      style: { fontSize: 13, fontWeight: 'bold', color: '#06d6a0' },
    });

    const topHeaderRow = new xb.UIPanel({
      pointerEvents: 'none',
      style: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
      children: [this.overlayPetTitleText, this.overlayMoodBadgeText],
    });

    this.overlayHungerText = new xb.UIText({
      text: '80% (Well-Fed)',
      pointerEvents: 'none',
      style: { fontSize: 12, fontWeight: 'bold', color: '#ff85a2' },
    });

    this.overlayHungerBar = new xb.UIPanel({
      pointerEvents: 'none',
      style: {
        width: '80%',
        height: '100%',
        backgroundColor: '#ff5c8a',
        borderRadius: 7,
      },
    });

    const hungerColumn = new xb.UIPanel({
      pointerEvents: 'none',
      style: {
        flexGrow: 1,
        flexDirection: 'column',
        gap: 5,
        padding: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 12,
      },
      children: [
        new xb.UIPanel({
          pointerEvents: 'none',
          style: {
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          },
          children: [
            new xb.UIText({
              text: 'HUNGER',
              pointerEvents: 'none',
              style: { fontSize: 12, fontWeight: 'bold', color: '#ffffff' },
            }),
            this.overlayHungerText,
          ],
        }),
        new xb.UIPanel({
          pointerEvents: 'none',
          style: {
            width: '100%',
            height: 12,
            backgroundColor: 'rgba(255, 255, 255, 0.14)',
            borderRadius: 6,
            overflow: 'hidden',
          },
          children: [this.overlayHungerBar],
        }),
      ],
    });

    this.overlayHappinessText = new xb.UIText({
      text: '85% (Joyful)',
      pointerEvents: 'none',
      style: { fontSize: 12, fontWeight: 'bold', color: '#06d6a0' },
    });

    this.overlayHappinessBar = new xb.UIPanel({
      pointerEvents: 'none',
      style: {
        width: '85%',
        height: '100%',
        backgroundColor: '#06d6a0',
        borderRadius: 7,
      },
    });

    const happinessColumn = new xb.UIPanel({
      pointerEvents: 'none',
      style: {
        flexGrow: 1,
        flexDirection: 'column',
        gap: 5,
        padding: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 12,
      },
      children: [
        new xb.UIPanel({
          pointerEvents: 'none',
          style: {
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          },
          children: [
            new xb.UIText({
              text: 'HAPPINESS',
              pointerEvents: 'none',
              style: { fontSize: 12, fontWeight: 'bold', color: '#ffffff' },
            }),
            this.overlayHappinessText,
          ],
        }),
        new xb.UIPanel({
          pointerEvents: 'none',
          style: {
            width: '100%',
            height: 12,
            backgroundColor: 'rgba(255, 255, 255, 0.14)',
            borderRadius: 6,
            overflow: 'hidden',
          },
          children: [this.overlayHappinessBar],
        }),
      ],
    });

    this.overlayXpText = new xb.UIText({
      text: '80/100 XP (LVL 3)',
      pointerEvents: 'none',
      style: { fontSize: 12, fontWeight: 'bold', color: '#ffd166' },
    });

    this.overlayXpBar = new xb.UIPanel({
      pointerEvents: 'none',
      style: {
        width: '80%',
        height: '100%',
        backgroundColor: '#ffd166',
        borderRadius: 7,
      },
    });

    const xpColumn = new xb.UIPanel({
      pointerEvents: 'none',
      style: {
        flexGrow: 1,
        flexDirection: 'column',
        gap: 5,
        padding: 8,
        backgroundColor: 'rgba(255, 209, 102, 0.08)',
        borderRadius: 12,
      },
      children: [
        new xb.UIPanel({
          pointerEvents: 'none',
          style: {
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          },
          children: [
            new xb.UIText({
              text: 'XP PROGRESS',
              pointerEvents: 'none',
              style: { fontSize: 12, fontWeight: 'bold', color: '#ffd166' },
            }),
            this.overlayXpText,
          ],
        }),
        new xb.UIPanel({
          pointerEvents: 'none',
          style: {
            width: '100%',
            height: 12,
            backgroundColor: 'rgba(255, 255, 255, 0.14)',
            borderRadius: 6,
            overflow: 'hidden',
          },
          children: [this.overlayXpBar],
        }),
      ],
    });

    const statsBarsRow = new xb.UIPanel({
      pointerEvents: 'none',
      style: {
        width: '100%',
        flexDirection: 'row',
        gap: 10,
      },
      children: [hungerColumn, happinessColumn, xpColumn],
    });

    this.overlaySleepBtn = new xb.UIButton({
      label: 'Put to Sleep',
      icon: 'bedtime',
      style: { flexGrow: 1, height: 36, fontSize: 12 },
      onClick: () => this.toggleSleepPet(),
    });

    const quickOverlayActions = new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'row',
        gap: 8,
      },
      children: [
        new xb.UIButton({
          label: 'Feed (+25 XP)',
          icon: 'restaurant',
          style: { flexGrow: 1, height: 36, fontSize: 12 },
          onClick: () => this.feedPet(),
        }),
        new xb.UIButton({
          label: 'Groom (+25 XP)',
          icon: 'favorite',
          style: { flexGrow: 1, height: 36, fontSize: 12 },
          onClick: () => this.groomPet(),
        }),
        new xb.UIButton({
          label: 'Play (+30 XP)',
          icon: 'sports_esports',
          style: { flexGrow: 1, height: 36, fontSize: 12 },
          onClick: () => this.playWithPet('Toy Ball'),
        }),
        this.overlaySleepBtn,
      ],
    });

    const overlay = new xb.UIOverlay({
      style: {
        width: 720,
        position: 'absolute',
        left: '50%',
        bottom: 24,
        transform: { translateX: '-50%' },
        flexDirection: 'column',
        gap: 8,
        padding: 14,
        backgroundColor: 'rgba(13, 18, 30, 0.88)',
        borderColor: 'rgba(255, 255, 255, 0.18)',
        borderWidth: 1.5,
        borderRadius: 18,
      },
      children: [
        new xb.UIExitButton(),
        topHeaderRow,
        statsBarsRow,
        quickOverlayActions,
      ],
    });
    overlay.name = 'Pet Stats Real-Time HUD Overlay';
    return overlay;
  }

  /**
   * Builds a 2D HTML DOM on-screen UI overlay anchored at the top of the screen
   * so 'hunger', 'happiness', and 'XP / Level' progress bars and care actions are always visible on-screen in real time.
   */
  private buildOnScreenDomHudOverlay() {
    if (typeof document === 'undefined') return;

    const existingVeil = document.getElementById('night-time-dim-veil');
    if (existingVeil) existingVeil.remove();

    const nightVeil = document.createElement('div');
    nightVeil.id = 'night-time-dim-veil';
    nightVeil.className = 'night-time-dim-veil';
    nightVeil.setAttribute('aria-hidden', 'true');
    document.body.appendChild(nightVeil);
    this.domNightVeilEl = nightVeil;

    const existing = document.getElementById('pet-stats-hud-overlay');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'pet-stats-hud-overlay';
    container.className = 'pet-hud-overlay';
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Virtual Pet Real-Time Hunger, Happiness, and XP Level HUD Overlay');

    container.innerHTML = `
      <div class="pet-hud-header">
        <div class="pet-hud-title-group">
          <span class="pet-hud-name" id="hud-pet-name">Mochi (BABY)</span>
          <span class="pet-hud-level" id="hud-pet-level">LVL 3</span>
          <span class="pet-hud-personality" id="hud-pet-personality" title="Pet Personality & Age Stage">🔎 PERSONALITY: CURIOUS (0.2d)</span>
        </div>
        <span class="pet-hud-mood" id="hud-pet-mood">MOOD: ECSTATIC</span>
      </div>
      <div class="pet-hud-bars-grid">
        <div class="pet-hud-stat-card">
          <div class="pet-hud-stat-top">
            <span class="pet-hud-stat-label">🍎 Hunger</span>
            <div class="pet-hud-stat-value-group">
              <span class="pet-hud-stat-state" id="hud-hunger-state">Well-Fed</span>
              <span class="pet-hud-stat-value" id="hud-hunger-value">80%</span>
            </div>
          </div>
          <div class="pet-hud-bar-track" role="progressbar" aria-label="Pet Hunger" aria-valuemin="0" aria-valuemax="100" aria-valuenow="80">
            <div class="pet-hud-bar-fill" id="hud-hunger-fill"></div>
          </div>
        </div>
        <div class="pet-hud-stat-card">
          <div class="pet-hud-stat-top">
            <span class="pet-hud-stat-label">💖 Happiness</span>
            <div class="pet-hud-stat-value-group">
              <span class="pet-hud-stat-state" id="hud-happiness-state">Joyful</span>
              <span class="pet-hud-stat-value" id="hud-happiness-value">85%</span>
            </div>
          </div>
          <div class="pet-hud-bar-track" role="progressbar" aria-label="Pet Happiness" aria-valuemin="0" aria-valuemax="100" aria-valuenow="85">
            <div class="pet-hud-bar-fill" id="hud-happiness-fill"></div>
          </div>
        </div>
        <div class="pet-hud-stat-card pet-hud-xp-card">
          <div class="pet-hud-stat-top">
            <span class="pet-hud-stat-label">⭐ Experience</span>
            <div class="pet-hud-stat-value-group">
              <span class="pet-hud-stat-state" id="hud-xp-state">Next: LVL 4</span>
              <span class="pet-hud-stat-value" id="hud-xp-value">80 / 100 XP</span>
            </div>
          </div>
          <div class="pet-hud-bar-track" role="progressbar" aria-label="Pet Experience XP" aria-valuemin="0" aria-valuemax="100" aria-valuenow="80">
            <div class="pet-hud-bar-fill pet-hud-xp-fill" id="hud-xp-fill"></div>
          </div>
        </div>
      </div>
      <div class="pet-hud-actions">
        <button type="button" class="pet-hud-action-btn" id="hud-btn-feed">🍎 Feed (+25 XP)</button>
        <button type="button" class="pet-hud-action-btn" id="hud-btn-groom">🪮 Groom (+25 XP)</button>
        <button type="button" class="pet-hud-action-btn" id="hud-btn-play">🎾 Play (+30 XP)</button>
        <button type="button" class="pet-hud-action-btn" id="hud-btn-sleep">🌙 Put to Sleep</button>
      </div>
      <div class="pet-hud-personality-row" aria-label="Personality Presets by Stats and Age">
        <span class="pet-hud-personality-label">🎭 Personality & Age:</span>
        <button type="button" class="pet-hud-trait-btn" id="hud-trait-playful">🤸 Playful</button>
        <button type="button" class="pet-hud-trait-btn" id="hud-trait-sleepy">🥱 Sleepy</button>
        <button type="button" class="pet-hud-trait-btn" id="hud-trait-curious">🔎 Curious (Young)</button>
        <button type="button" class="pet-hud-trait-btn" id="hud-trait-wise">🦉 Wise (Elder)</button>
      </div>
    `;

    document.body.appendChild(container);

    this.domHudContainer = container;
    this.domPetNameEl = container.querySelector('#hud-pet-name') as HTMLElement;
    this.domPetLevelEl = container.querySelector('#hud-pet-level') as HTMLElement;
    this.domPetPersonalityEl = container.querySelector('#hud-pet-personality') as HTMLElement;
    this.domPetMoodEl = container.querySelector('#hud-pet-mood') as HTMLElement;
    this.domHungerFillEl = container.querySelector('#hud-hunger-fill') as HTMLElement;
    this.domHungerValueEl = container.querySelector('#hud-hunger-value') as HTMLElement;
    this.domHungerStateEl = container.querySelector('#hud-hunger-state') as HTMLElement;
    this.domHappinessFillEl = container.querySelector('#hud-happiness-fill') as HTMLElement;
    this.domHappinessValueEl = container.querySelector('#hud-happiness-value') as HTMLElement;
    this.domHappinessStateEl = container.querySelector('#hud-happiness-state') as HTMLElement;
    this.domXpFillEl = container.querySelector('#hud-xp-fill') as HTMLElement;
    this.domXpValueEl = container.querySelector('#hud-xp-value') as HTMLElement;
    this.domXpStateEl = container.querySelector('#hud-xp-state') as HTMLElement;
    this.domSleepBtnEl = container.querySelector('#hud-btn-sleep') as HTMLButtonElement;

    const feedBtn = container.querySelector('#hud-btn-feed');
    feedBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.feedPet();
    });

    const groomBtn = container.querySelector('#hud-btn-groom');
    groomBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.groomPet();
    });

    const playBtn = container.querySelector('#hud-btn-play');
    playBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.playWithPet('Toy Ball');
    });

    this.domSleepBtnEl?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSleepPet();
    });

    container.querySelector('#hud-trait-playful')?.addEventListener('click', (e) => {
      e.stopPropagation();
      petManager.applyPersonalityPreset('Playful');
      this.petRef.spawnStars(6);
      this.petRef.triggerFlip();
    });
    container.querySelector('#hud-trait-sleepy')?.addEventListener('click', (e) => {
      e.stopPropagation();
      petManager.applyPersonalityPreset('Sleepy');
    });
    container.querySelector('#hud-trait-curious')?.addEventListener('click', (e) => {
      e.stopPropagation();
      petManager.applyPersonalityPreset('Curious');
      this.petRef.spawnBubbles(5);
    });
    container.querySelector('#hud-trait-wise')?.addEventListener('click', (e) => {
      e.stopPropagation();
      petManager.applyPersonalityPreset('Wise');
      this.petRef.spawnStars(8);
    });
  }

  public refreshARControlsUI() {
    if (!this.arPlacementRef) return;
    const isAR = this.arPlacementRef.isPassThroughEnabled;
    const isPlacing = this.arPlacementRef.isPlacementModeActive;

    this.arModeToggleBtn.label = isAR ? 'AR Pass-Through: ON' : 'VR Sanctuary: ON';
    this.surfaceAnchorBtn.label = isPlacing ? 'Cancel Surface Aim' : 'Anchor to Surface';

    if (isPlacing) {
      this.arStatusText.text = 'WebXR Hit-Test Active: Point at a surface & pinch/click to place pet!';
      this.arStatusText.style.color = '#ffd166';
    } else if (isAR) {
      const pos = this.arPlacementRef.getAnchoredPosition();
      this.arStatusText.text = `AR Pass-Through Active | Pet Anchored at (${pos.x.toFixed(2)}m, ${pos.y.toFixed(2)}m, ${pos.z.toFixed(2)}m)`;
      this.arStatusText.style.color = '#00f5d4';
    } else {
      this.arStatusText.text = 'VR Sanctuary Mode | Toggle AR Pass-Through to see your physical space';
      this.arStatusText.style.color = '#c49df5';
    }
  }

  /**
   * Interactive 'Feed Pet' handler invoked from the Spatial UI buttons.
   * Triggers the 3D feeding animation, plays multi-bite eating audio, increases `hunger` and XP (+25 XP),
   * and contributes to the 24-hour Daily Streak.
   */
  public feedPet(snackType?: 'apple' | 'cake' | 'sushi' | 'cookie') {
    const streakReward = petManager.feedPet(snackType);
    if (streakReward) {
      this.streakShrineRef?.triggerCelebrationBurst();
    } else {
      this.streakShrineRef?.syncWithStreakState();
    }
    this.refreshStreakPanelUI();
  }

  /**
   * Interactive 'Groom Pet' handler invoked from the Spatial UI button or 3D Grooming Brush.
   * Triggers the 3D brushing animation, plays soothing brush & purr audio, increases `happiness` and XP (+25 XP),
   * and contributes to the 24-hour Daily Streak.
   */
  public groomPet() {
    const streakReward = petManager.groomPet();
    if (streakReward) {
      this.streakShrineRef?.triggerCelebrationBurst();
    } else {
      this.streakShrineRef?.syncWithStreakState();
    }
    this.refreshStreakPanelUI();
  }

  /**
   * Interactive 'Play with Pet' handler invoked from the HUD actions, Care panel, or 3D Toy Ball.
   * Triggers playful flip & star burst, increases `happiness` and XP (+30 XP), and levels up the pet when XP fills.
   */
  public playWithPet(activityLabel: string = 'Toy Ball') {
    const streakReward = petManager.playWithPet(activityLabel);
    this.petRef.spawnStars(8);
    this.petRef.spawnHearts(5);
    this.petRef.triggerFlip();
    if (streakReward) {
      this.streakShrineRef?.triggerCelebrationBurst();
    } else {
      this.streakShrineRef?.syncWithStreakState();
    }
    this.refreshStreakPanelUI();
  }

  /**
   * Interactive 'Put to Sleep' / 'Wake Up' handler invoked from the HUD actions or Care panel.
   * Initiates the pet's sleeping state, pauses hunger depletion, and triggers a gentle night-time UI dimming effect.
   */
  public toggleSleepPet() {
    petManager.toggleSleep();
    this.streakShrineRef?.syncWithStreakState();
    this.refreshStreakPanelUI();
  }

  private createNeedRow(label: string, fillPanel: xb.UIPanel, valText: xb.UIText): xb.UIPanel {
    const track = new xb.UIPanel({
      style: {
        width: 140,
        height: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 6,
        overflow: 'hidden',
      },
      children: [fillPanel],
    });

    return new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
      children: [
        new xb.UIText({ text: label, style: { fontSize: 14, fontWeight: 'bold' } }),
        new xb.UIPanel({
          style: { flexDirection: 'row', alignItems: 'center', gap: 8 },
          children: [track, valText],
        }),
      ],
    });
  }

  private createMiniBtn(label: string, onClick: () => void): xb.UIButton {
    return new xb.UIButton({
      label,
      style: {
        flexGrow: 1,
        height: 36,
        paddingLeft: 8,
        paddingRight: 8,
        fontSize: 13,
      },
      onClick,
    });
  }

  public switchTab(tab: 'care' | 'streak' | 'stylist' | 'games' | 'leaderboard') {
    this.currentTab = tab;
    sound.playClick();

    this.carePanel.style.display = tab === 'care' ? 'flex' : 'none';
    this.streakPanel.style.display = tab === 'streak' ? 'flex' : 'none';
    this.stylistPanel.style.display = tab === 'stylist' ? 'flex' : 'none';
    this.gamesPanel.style.display = tab === 'games' ? 'flex' : 'none';
    this.leaderboardPanel.style.display = tab === 'leaderboard' ? 'flex' : 'none';

    if (tab === 'streak') {
      this.refreshStreakPanelUI();
    } else if (tab === 'leaderboard') {
      this.refreshLeaderboardUI();
    }
  }

  public refreshStreakPanelUI() {
    const state = petManager.getState();
    const isAvailable = petManager.isStreakRewardAvailable();
    const nextDay = state.dailyStreak + 1;
    const nextTier = petManager.getRewardTierForDay(nextDay);

    this.streakHeaderTitle.text = `${state.dailyStreak} Day Streak | Best: ${state.bestStreak} Days`;
    this.streakCountdownText.text = petManager.getStreakCountdownFormatted().replace(/[^\x20-\x7E]/g, '').trim();
    this.streakCountdownText.style.color = isAvailable ? '#ffd166' : '#00f5d4';

    const unlockStr = nextTier.unlockedAccessory ? ` + ${nextTier.unlockedAccessory.toUpperCase()}` : '';
    const cleanTitle = nextTier.title.replace(/[^\x20-\x7E]/g, '').trim();
    this.streakRewardTierText.text = `Next (${cleanTitle}): +${nextTier.expBonus} XP, +${nextTier.affectionBonus} Affection${unlockStr}`;

    this.claimDailyRewardBtn.label = isAvailable
      ? `Claim Day ${nextDay} Reward`
      : 'Claimed Today [OK]';

    // Rebuild 7-day calendar rows (4 in row 1, 3 in row 2)
    while (this.streakCalendarRow1.children.length > 0) {
      this.streakCalendarRow1.remove(this.streakCalendarRow1.children[0]);
    }
    while (this.streakCalendarRow2.children.length > 0) {
      this.streakCalendarRow2.remove(this.streakCalendarRow2.children[0]);
    }

    const activeCycleCount = state.dailyStreak % 7;

    STREAK_TIERS.forEach((tier, idx) => {
      const isCompleted = idx < activeCycleCount || (state.dailyStreak > 0 && activeCycleCount === 0 && state.streakClaimedToday);
      const isNextTarget = idx === activeCycleCount && isAvailable;

      const bg = isCompleted
        ? 'rgba(6, 214, 160, 0.28)'
        : isNextTarget
          ? 'rgba(255, 209, 102, 0.28)'
          : 'rgba(255, 255, 255, 0.06)';
      const borderCol = isCompleted
        ? '#06d6a0'
        : isNextTarget
          ? '#ffd166'
          : 'rgba(255, 255, 255, 0.14)';

      const badge = new xb.UIPanel({
        style: {
          flexGrow: 1,
          flexDirection: 'column',
          alignItems: 'center',
          padding: 6,
          borderRadius: 10,
          backgroundColor: bg,
          borderColor: borderCol,
          borderWidth: 1.5,
          gap: 2,
        },
        children: [
          new xb.UIText({
            text: `Day ${tier.day}${isCompleted ? ' [DONE]' : isNextTarget ? ' [NEXT]' : ''}`,
            style: {
              fontSize: 12,
              fontWeight: 'bold',
              color: isCompleted ? '#06d6a0' : isNextTarget ? '#ffd166' : '#ffffff',
            },
          }),
          new xb.UIText({
            text: `+${tier.expBonus} XP`,
            style: { fontSize: 11, opacity: 0.85 },
          }),
        ],
      });

      if (idx < 4) {
        this.streakCalendarRow1.add(badge);
      } else {
        this.streakCalendarRow2.add(badge);
      }
    });
  }

  private onStateChanged(state: PetState) {
    const moodInfo = petManager.getMoodInfo();
    const personalityInfo = petManager.getPersonalityInfo();
    const xpProg = petManager.getXpProgress();
    this.titleText.text = `${state.name} (${state.stage.toUpperCase()})`;
    const streakStatus = petManager.isStreakRewardAvailable() ? 'READY' : `${state.dailyStreak}d`;
    this.subtitleText.text = `Age: ${personalityInfo.ageDaysFormatted} (${personalityInfo.ageTitle}) | Trait: ${personalityInfo.label} | Streak: ${streakStatus}`;
    this.levelBadgeText.text = `LVL ${state.level} (${xpProg.currentXp}/${xpProg.maxXp} XP)`;

    // Update live Personality & Mood Status Banner in Care Tab
    if (this.moodStatusText && this.moodStatusBadgePanel) {
      this.moodStatusText.text = `PERSONALITY: ${personalityInfo.label} (${personalityInfo.ageTitle}) - ${personalityInfo.summary}`;
      this.moodStatusText.style.color = personalityInfo.cssColor;
      this.moodStatusBadgePanel.style.borderColor = personalityInfo.cssColor;
    }

    // Needs & XP values & progress bars
    const h = Math.round(state.hunger);
    const e = Math.round(state.energy);
    const hap = Math.round(state.happiness);
    const hyg = Math.round(state.hygiene);

    if (this.xpText && this.xpBar) {
      this.xpText.text = `${xpProg.currentXp} / ${xpProg.maxXp} XP`;
      this.xpBar.style.width = `${Math.max(4, xpProg.percentage)}%`;
    }

    // Dynamic color & status calculation for Hunger and Happiness
    const hungerColor = state.isSleeping
      ? '#c49df5'
      : h < 25
        ? '#ff0054'
        : h < 50
          ? '#ffd166'
          : '#ff5c8a';
    const hungerTag = state.isSleeping
      ? 'Paused (Sleeping)'
      : h < 25
        ? 'Starving!'
        : h < 50
          ? 'Peckish'
          : h >= 85
            ? 'Full'
            : 'Well-Fed';

    const happinessColor = hap < 25 ? '#3a86ff' : hap < 50 ? '#ffd166' : '#06d6a0';
    const happinessTag = state.isSleeping
      ? 'Dreaming'
      : hap < 25
        ? 'Lonely!'
        : hap < 50
          ? 'Needs Play'
          : hap >= 85
            ? 'Radiant'
            : 'Joyful';

    this.hungerText.text = `${h}%`;
    this.hungerBar.style.width = `${Math.max(4, h)}%`;
    this.hungerBar.style.backgroundColor = hungerColor;

    this.energyText.text = `${e}%`;
    this.energyBar.style.width = `${Math.max(4, e)}%`;

    this.happinessText.text = `${hap}%`;
    this.happinessBar.style.width = `${Math.max(4, hap)}%`;
    this.happinessBar.style.backgroundColor = happinessColor;

    this.hygieneText.text = `${hyg}%`;
    this.hygieneBar.style.width = `${Math.max(4, hyg)}%`;

    // Update On-Screen XR Viewport UIOverlay progress bars & night-time UI dimming
    if (this.overlayPetTitleText) {
      this.overlayPetTitleText.text = `${state.name.toUpperCase()} (${state.stage.toUpperCase()}) - LVL ${state.level} (${xpProg.currentXp}/${xpProg.maxXp} XP)`;
    }
    if (this.overlayMoodBadgeText) {
      this.overlayMoodBadgeText.text = `TRAIT: ${personalityInfo.label} (${personalityInfo.ageDaysFormatted}) | MOOD: ${moodInfo.label}`;
      this.overlayMoodBadgeText.style.color = personalityInfo.cssColor;
    }
    if (this.overlayHungerText && this.overlayHungerBar) {
      this.overlayHungerText.text = `${h}% (${hungerTag})`;
      this.overlayHungerText.style.color = hungerColor;
      this.overlayHungerBar.style.width = `${Math.max(4, state.hunger)}%`;
      this.overlayHungerBar.style.backgroundColor = hungerColor;
    }
    if (this.overlayHappinessText && this.overlayHappinessBar) {
      this.overlayHappinessText.text = `${hap}% (${happinessTag})`;
      this.overlayHappinessText.style.color = happinessColor;
      this.overlayHappinessBar.style.width = `${Math.max(4, state.happiness)}%`;
      this.overlayHappinessBar.style.backgroundColor = happinessColor;
    }
    if (this.overlayXpText && this.overlayXpBar) {
      this.overlayXpText.text = `${xpProg.currentXp}/${xpProg.maxXp} XP (LVL ${state.level})`;
      this.overlayXpBar.style.width = `${Math.max(4, xpProg.percentage)}%`;
    }
    if (this.overlaySleepBtn) {
      this.overlaySleepBtn.label = state.isSleeping ? 'Wake Up Pet' : 'Put to Sleep';
    }
    if (this.overlay && this.overlay.style) {
      this.overlay.style.backgroundColor = state.isSleeping
        ? 'rgba(8, 10, 24, 0.94)'
        : 'rgba(13, 18, 30, 0.88)';
      this.overlay.style.borderColor = state.isSleeping
        ? 'rgba(161, 98, 232, 0.45)'
        : 'rgba(255, 255, 255, 0.18)';
    }
    if (this.card && this.card.style) {
      this.card.style.backgroundColor = state.isSleeping
        ? 'rgba(8, 10, 24, 0.94)'
        : 'rgba(15, 20, 32, 0.88)';
      this.card.style.borderColor = state.isSleeping
        ? 'rgba(161, 98, 232, 0.42)'
        : 'rgba(255, 255, 255, 0.18)';
    }

    // Update On-Screen 2D DOM HUD Overlay progress bars & gentle night-time UI dimming
    this.domNightVeilEl?.classList.toggle('active', state.isSleeping);
    this.domHudContainer?.classList.toggle('is-sleeping-night', state.isSleeping);

    if (this.domSleepBtnEl) {
      this.domSleepBtnEl.textContent = state.isSleeping ? '☀️ Wake Up Pet' : '🌙 Put to Sleep';
      this.domSleepBtnEl.classList.toggle('sleep-active', state.isSleeping);
    }

    if (this.domPetNameEl) {
      this.domPetNameEl.textContent = `${state.name} (${state.stage.toUpperCase()})`;
    }
    if (this.domPetLevelEl) {
      this.domPetLevelEl.textContent = `LVL ${state.level}`;
    }
    if (this.domPetPersonalityEl) {
      this.domPetPersonalityEl.textContent = `${personalityInfo.iconEmoji} PERSONALITY: ${personalityInfo.label} (${personalityInfo.ageDaysFormatted})`;
      this.domPetPersonalityEl.style.color = personalityInfo.cssColor;
      this.domPetPersonalityEl.style.borderColor = personalityInfo.cssColor;
    }
    if (this.domPetMoodEl) {
      this.domPetMoodEl.textContent = `MOOD: ${moodInfo.label}`;
      this.domPetMoodEl.style.color = moodInfo.cssColor;
      this.domPetMoodEl.style.borderColor = moodInfo.cssColor;
    }
    if (this.domHungerFillEl && this.domHungerValueEl && this.domHungerStateEl) {
      const exactHunger = Math.max(0, Math.min(100, state.hunger));
      this.domHungerFillEl.style.width = `${exactHunger.toFixed(1)}%`;
      this.domHungerFillEl.style.backgroundColor = hungerColor;
      this.domHungerFillEl.style.boxShadow = `0 0 10px ${hungerColor}88`;
      this.domHungerValueEl.textContent = `${h}%`;
      this.domHungerValueEl.style.color = hungerColor;
      this.domHungerStateEl.textContent = hungerTag;
      this.domHungerFillEl.parentElement?.setAttribute('aria-valuenow', String(h));
    }
    if (this.domHappinessFillEl && this.domHappinessValueEl && this.domHappinessStateEl) {
      const exactHappiness = Math.max(0, Math.min(100, state.happiness));
      this.domHappinessFillEl.style.width = `${exactHappiness.toFixed(1)}%`;
      this.domHappinessFillEl.style.backgroundColor = happinessColor;
      this.domHappinessFillEl.style.boxShadow = `0 0 10px ${happinessColor}88`;
      this.domHappinessValueEl.textContent = `${hap}%`;
      this.domHappinessValueEl.style.color = happinessColor;
      this.domHappinessStateEl.textContent = happinessTag;
      this.domHappinessFillEl.parentElement?.setAttribute('aria-valuenow', String(hap));
    }
    if (this.domXpFillEl && this.domXpValueEl && this.domXpStateEl) {
      this.domXpFillEl.style.width = `${xpProg.percentage}%`;
      this.domXpValueEl.textContent = `${xpProg.currentXp} / ${xpProg.maxXp} XP`;
      this.domXpFillEl.parentElement?.setAttribute('aria-valuenow', String(xpProg.currentXp));
      this.domXpFillEl.parentElement?.setAttribute('aria-valuemax', String(xpProg.maxXp));
      if (!this.domXpStateEl.classList.contains('xp-gain-highlight')) {
        this.domXpStateEl.textContent = `Next: LVL ${state.level + 1}`;
      }
    }

    this.sleepBtn.label = state.isSleeping ? 'Wake Up Pet' : 'Put to Sleep';

    // Stylist labels
    this.speciesText.text = `Current: ${state.species.toUpperCase()}`;
    const colorDef = PET_COLORS[state.colorId];
    this.colorText.text = `Color: ${colorDef.name}`;
    this.accessoryText.text = `Accessory: ${state.accessory.toUpperCase()}`;

    // Mini-games score label
    this.gameScoreText.text = `Personal Best: ${state.miniGameHighScore} pts | Affection: ${state.affection}`;

    if (this.currentTab === 'streak' && this.streakHeaderTitle) {
      this.refreshStreakPanelUI();
    }

    // Rebuild 3D model
    this.petRef.rebuildModel(state);
  }

  private selectSpecies(species: PetSpecies) {
    petManager.setSpecies(species);
  }

  private selectColor(colorId: PetColorId) {
    petManager.setColor(colorId);
  }

  private selectAccessory(accessory: PetAccessory) {
    petManager.setAccessory(accessory);
  }

  private startBerryDropGame() {
    this.simonControlsPanel.style.display = 'none';
    this.gameStatusText.text = 'Catch falling berries! Point / tap in space!';

    this.miniGames.startBerryCatch(
      (score, timeSec, combo) => {
        this.gameStatusText.text = `Time: ${timeSec}s | Score: ${score} | Combo: x${combo}`;
      },
      (result) => {
        this.gameStatusText.text = `Game Over! Final Score: ${result.score}! (+${result.happinessGain}% Happiness, +${result.expGain} XP)`;
      }
    );
  }

  private startSimonDanceGame() {
    this.simonControlsPanel.style.display = 'flex';
    this.gameStatusText.text = 'Round 1: Watch pet dance, then repeat with buttons below!';

    this.miniGames.startSimonDance(
      (move, isPlayerTurn) => {
        if (isPlayerTurn) {
          this.gameStatusText.text = 'Your Turn! Tap the matching dance buttons!';
        } else if (move >= 0) {
          const moveNames = ['Left Hop', 'High Jump', 'Right Hop', '360 Spin'];
          this.gameStatusText.text = `Pet Move: ${moveNames[move]}`;
        }
      },
      (result) => {
        this.simonControlsPanel.style.display = 'none';
        this.gameStatusText.text = `Dance Off Complete! Score: ${result.score}! (+${result.happinessGain}% Happiness, +${result.expGain} XP)`;
      }
    );
  }

  private refreshLeaderboardUI() {
    // Clear old rows
    while (this.leaderboardListPanel.children.length > 0) {
      this.leaderboardListPanel.remove(this.leaderboardListPanel.children[0]);
    }

    const entries = petManager.getLeaderboard();

    // Show top 6 entries
    entries.slice(0, 6).forEach((entry) => {
      const isUser = entry.isUser;
      const rankColor = entry.rank === 1 ? '#ffd166' : entry.rank === 2 ? '#c0c0c0' : entry.rank === 3 ? '#cd7f32' : '#ffffff';

      const row = new xb.UIPanel({
        style: {
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 8,
          borderRadius: 10,
          backgroundColor: isUser ? 'rgba(0, 245, 212, 0.22)' : 'rgba(255, 255, 255, 0.05)',
          borderColor: isUser ? '#00f5d4' : 'transparent',
          borderWidth: isUser ? 1.5 : 0,
        },
        children: [
          new xb.UIPanel({
            style: { flexDirection: 'row', alignItems: 'center', gap: 10 },
            children: [
              new xb.UIText({
                text: `#${entry.rank}`,
                style: { fontSize: 16, fontWeight: 'bold', color: rankColor, width: 34 },
              }),
              new xb.UIPanel({
                style: { flexDirection: 'column' },
                children: [
                  new xb.UIText({
                    text: `${entry.petName} ${isUser ? '(YOU)' : ''}`,
                    style: { fontSize: 15, fontWeight: 'bold', color: isUser ? '#00f5d4' : '#ffffff' },
                  }),
                  new xb.UIText({
                    text: `${entry.species.toUpperCase()} | ${entry.stage.toUpperCase()}`,
                    style: { fontSize: 11, opacity: 0.65 },
                  }),
                ],
              }),
            ],
          }),
          new xb.UIPanel({
            style: { flexDirection: 'column', alignItems: 'flex-end' },
            children: [
              new xb.UIText({
                text: `LVL ${entry.level}`,
                style: { fontSize: 15, fontWeight: 'bold', color: '#ffd166' },
              }),
              new xb.UIText({
                text: `${entry.affection} Affection | ${entry.ageDays}d`,
                style: { fontSize: 11, opacity: 0.7 },
              }),
            ],
          }),
        ],
      });

      this.leaderboardListPanel.add(row);
    });
  }

  public dispose() {
    this.domNightVeilEl?.remove();
    this.domHudContainer?.remove();
  }
}

