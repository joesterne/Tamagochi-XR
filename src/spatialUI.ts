import * as xb from 'xrblocks';
import { PetAccessory, PetColorId, PetSpecies, PetState } from './types';
import { PET_COLORS, STREAK_TIERS, petManager } from './petManager';
import { sound } from './sound';
import { MiniGameManager } from './miniGames';
import { PetRenderer } from './petRenderer';
import { DailyStreakShrine } from './streakShrine';

export class TamagotchiSpatialUI {
  public card: xb.UICard;
  private petRef: PetRenderer;
  private miniGames: MiniGameManager;
  private streakShrineRef?: DailyStreakShrine;

  // Active Tab: 'care' | 'streak' | 'stylist' | 'games' | 'leaderboard'
  private currentTab: 'care' | 'streak' | 'stylist' | 'games' | 'leaderboard' = 'care';

  // Header Elements
  private titleText: xb.UIText;
  private subtitleText: xb.UIText;
  private levelBadgeText: xb.UIText;

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

  constructor(pet: PetRenderer, miniGames: MiniGameManager, streakShrine?: DailyStreakShrine) {
    this.petRef = pet;
    this.miniGames = miniGames;
    this.streakShrineRef = streakShrine;

    // Header elements
    this.titleText = new xb.UIText({
      text: 'Mochi (Baby)',
      style: { fontSize: 25, fontWeight: 'bold', color: '#ffffff' },
    });
    this.subtitleText = new xb.UIText({
      text: 'Age: 0.2 days • Daily Streak: 2 🔥',
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
        paddingBottom: 6,
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

    // Tab buttons
    this.tabCareBtn = new xb.UIButton({
      label: 'Care',
      icon: 'favorite',
      style: { flexGrow: 1, height: 38, fontSize: 13 },
      onClick: () => this.switchTab('care'),
    });
    this.tabStreakBtn = new xb.UIButton({
      label: 'Streak 🔥',
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
        this.createNeedRow('Hunger 🍎', this.hungerBar, this.hungerText),
        this.createNeedRow('Energy ⚡', this.energyBar, this.energyText),
        this.createNeedRow('Happiness 💖', this.happinessBar, this.happinessText),
        this.createNeedRow('Hygiene 🧼', this.hygieneBar, this.hygieneText),
      ],
    });

    this.sleepBtn = new xb.UIButton({
      label: 'Nap Time',
      icon: 'bedtime',
      style: { flexGrow: 1, height: 42 },
      onClick: () => {
        petManager.toggleSleep();
      },
    });

    const careRow1 = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 8 },
      children: [
        new xb.UIButton({
          label: 'Feed 🍎',
          icon: 'restaurant',
          style: { flexGrow: 1, height: 42 },
          onClick: () => {
            const snacks: Array<'apple' | 'cake' | 'sushi' | 'cookie'> = ['apple', 'cake', 'sushi', 'cookie'];
            const chosen = snacks[Math.floor(Math.random() * snacks.length)];
            petManager.feed(chosen);
            this.petRef.spawnHearts(5);
          },
        }),
        new xb.UIButton({
          label: 'Clean 🧼',
          icon: 'soap',
          style: { flexGrow: 1, height: 42 },
          onClick: () => {
            petManager.clean();
            this.petRef.spawnBubbles(10);
          },
        }),
      ],
    });

    const careRow2 = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 8 },
      children: [
        new xb.UIButton({
          label: 'Pet / Cuddle ❤️',
          icon: 'favorite',
          style: { flexGrow: 1, height: 42 },
          onClick: () => {
            petManager.pet();
            this.petRef.spawnHearts(8);
            this.petRef.triggerFlip();
          },
        }),
        this.sleepBtn,
      ],
    });

    this.carePanel = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'column', gap: 10 },
      children: [needsContainer, careRow1, careRow2],
    });

    // --- Daily Streak Panel Setup ---
    this.streakHeaderTitle = new xb.UIText({
      text: '🔥 2 Day Streak • Best: 2 Days',
      style: { fontSize: 18, fontWeight: 'bold', color: '#ffd166', textAlign: 'center' },
    });

    this.streakCountdownText = new xb.UIText({
      text: 'READY NOW! Interact with pet 🔥',
      style: { fontSize: 14, fontWeight: 'bold', color: '#00f5d4', textAlign: 'center' },
    });

    this.streakRewardTierText = new xb.UIText({
      text: 'Next Milestone: Day 3 Golden Apple (+110 XP, +35 ❤️, Flower Crown)',
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
      label: 'Claim 24h Streak Reward 🔥',
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
          petManager.say(`Already claimed today! ${petManager.getStreakCountdownFormatted()} ⏳`, 4);
        }
        this.refreshStreakPanelUI();
      },
    });

    const simulate24hBtn = new xb.UIButton({
      label: '+24h Fast-Forward ⏩',
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
        this.createMiniBtn('Blobby 🐰', () => this.selectSpecies('blobby')),
        this.createMiniBtn('Pipsqueak 🐥', () => this.selectSpecies('pipsqueak')),
        this.createMiniBtn('Draco 🐉', () => this.selectSpecies('draco')),
        this.createMiniBtn('Kitsune 🦊', () => this.selectSpecies('kitsune')),
      ],
    });

    // Colors Row
    const colorRow1 = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 6 },
      children: [
        this.createMiniBtn('Pink 🌸', () => this.selectColor('pink')),
        this.createMiniBtn('Mint 🍃', () => this.selectColor('mint')),
        this.createMiniBtn('Purple 🔮', () => this.selectColor('purple')),
      ],
    });
    const colorRow2 = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 6 },
      children: [
        this.createMiniBtn('Gold ☀️', () => this.selectColor('gold')),
        this.createMiniBtn('Blue 💎', () => this.selectColor('blue')),
        this.createMiniBtn('Sunset 🌅', () => this.selectColor('sunset')),
      ],
    });

    // Accessory Row
    const accessoryRow1 = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 6 },
      children: [
        this.createMiniBtn('None 🌿', () => this.selectAccessory('none')),
        this.createMiniBtn('Crown 👑', () => this.selectAccessory('crown')),
        this.createMiniBtn('Wizard 🧙', () => this.selectAccessory('wizard')),
        this.createMiniBtn('Glasses 😎', () => this.selectAccessory('sunglasses')),
      ],
    });
    const accessoryRow2 = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 6 },
      children: [
        this.createMiniBtn('Wings 🪽', () => this.selectAccessory('wings')),
        this.createMiniBtn('Bowtie 🎀', () => this.selectAccessory('bowtie')),
        this.createMiniBtn('Flower 🌼', () => this.selectAccessory('flower')),
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
          label: '👈 Left Hop',
          style: { flexGrow: 1, height: 44, backgroundColor: '#3a86ff' },
          onClick: () => this.miniGames.handlePlayerSimonInput(0),
        }),
        new xb.UIButton({
          label: '👆 Jump',
          style: { flexGrow: 1, height: 44, backgroundColor: '#ff006e' },
          onClick: () => this.miniGames.handlePlayerSimonInput(1),
        }),
        new xb.UIButton({
          label: '👉 Right Hop',
          style: { flexGrow: 1, height: 44, backgroundColor: '#fb5607' },
          onClick: () => this.miniGames.handlePlayerSimonInput(2),
        }),
        new xb.UIButton({
          label: '🔄 360 Spin',
          style: { flexGrow: 1, height: 44, backgroundColor: '#8338ec' },
          onClick: () => this.miniGames.handlePlayerSimonInput(3),
        }),
      ],
    });

    const gamesLaunchRow = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 10 },
      children: [
        new xb.UIButton({
          label: 'Berry Drop 🍓',
          icon: 'play_arrow',
          style: { flexGrow: 1, height: 44 },
          onClick: () => this.startBerryDropGame(),
        }),
        new xb.UIButton({
          label: 'Simon Dance 🎵',
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

    // Subscribe to state updates
    petManager.subscribe((state) => this.onStateChanged(state));
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

    this.streakHeaderTitle.text = `🔥 ${state.dailyStreak} Day Streak • Best: ${state.bestStreak} Days`;
    this.streakCountdownText.text = petManager.getStreakCountdownFormatted();
    this.streakCountdownText.style.color = isAvailable ? '#ffd166' : '#00f5d4';

    const unlockStr = nextTier.unlockedAccessory ? ` + ${nextTier.unlockedAccessory.toUpperCase()}` : '';
    this.streakRewardTierText.text = `Next (${nextTier.title}): +${nextTier.expBonus} XP, +${nextTier.affectionBonus} ❤️${unlockStr}`;

    this.claimDailyRewardBtn.label = isAvailable
      ? `Claim Day ${nextDay} Reward 🔥`
      : 'Claimed Today ✓';

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
            text: `Day ${tier.day} ${isCompleted ? '✓' : isNextTarget ? '🔥' : ''}`,
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
    this.titleText.text = `${state.name} (${state.stage.toUpperCase()})`;
    const streakStatus = petManager.isStreakRewardAvailable() ? 'READY 🔥' : `${state.dailyStreak}d 🔥`;
    this.subtitleText.text = `Age: ${(state.ageHours / 24).toFixed(1)}d • Daily Streak: ${streakStatus}`;
    this.levelBadgeText.text = `LVL ${state.level}`;

    // Needs values & progress bars
    const h = Math.round(state.hunger);
    const e = Math.round(state.energy);
    const hap = Math.round(state.happiness);
    const hyg = Math.round(state.hygiene);

    this.hungerText.text = `${h}%`;
    this.hungerBar.style.width = `${Math.max(5, h)}%`;

    this.energyText.text = `${e}%`;
    this.energyBar.style.width = `${Math.max(5, e)}%`;

    this.happinessText.text = `${hap}%`;
    this.happinessBar.style.width = `${Math.max(5, hap)}%`;

    this.hygieneText.text = `${hyg}%`;
    this.hygieneBar.style.width = `${Math.max(5, hyg)}%`;

    this.sleepBtn.label = state.isSleeping ? 'Wake Up ☀️' : 'Nap Time 🌙';

    // Stylist labels
    this.speciesText.text = `Current: ${state.species.toUpperCase()}`;
    const colorDef = PET_COLORS[state.colorId];
    this.colorText.text = `Color: ${colorDef.name}`;
    this.accessoryText.text = `Accessory: ${state.accessory.toUpperCase()}`;

    // Mini-games score label
    this.gameScoreText.text = `Personal Best: ${state.miniGameHighScore} pts • Affection: ${state.affection} ❤️`;

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
        this.gameStatusText.text = `Time: ${timeSec}s • Score: ${score} • Combo: x${combo}`;
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
          const moveNames = ['Left Hop 👈', 'Jump 👆', 'Right Hop 👉', '360 Spin 🔄'];
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
                    text: `${entry.species.toUpperCase()} • ${entry.stage.toUpperCase()}`,
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
                text: `${entry.affection} ❤️ • ${entry.ageDays}d`,
                style: { fontSize: 11, opacity: 0.7 },
              }),
            ],
          }),
        ],
      });

      this.leaderboardListPanel.add(row);
    });
  }
}
