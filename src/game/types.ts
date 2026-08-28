/**
 * River Raid Remaster — Tipos compartilhados
 * ------------------------------------------
 * Tipos centrais usados pelo motor, entidades, sistemas e pela UI React.
 */

export type GameState =
  | 'menu'
  | 'chapterIntro'
  | 'bossIntro'
  | 'playing'
  | 'paused'
  | 'gameover';

export type EnemyKind =
  | 'boat' // barco de patrulha (horizontal)
  | 'armored' // barco blindado (2 HP)
  | 'heli' // helicóptero
  | 'stealth' // helicóptero furtivo (semi-transparente)
  | 'jet' // jato rápido
  | 'drone' // drone perseguidor
  | 'zigzag' // drone em zigue-zague
  | 'turret'; // torre automática na margem

export type PowerUpKind = 'shield' | 'triple' | 'homing' | 'turbo';

export type FuelKind = 'normal' | 'rare' | 'fake';

export type BossId = 1 | 2 | 3;

export interface MissionHudInfo {
  id: string;
  description: string;
  progress: number;
  goal: number;
  completed: boolean;
  reward: string;
}

export interface PowerUpHudInfo {
  kind: PowerUpKind;
  timeLeft: number;
  duration: number;
}

export interface BossHudInfo {
  name: string;
  hp: number;
  maxHp: number;
}

/** Estado sincronizado com a UI React (atualizado ~10x/s). */
export interface HudState {
  state: GameState;
  score: number;
  hiScore: number;
  credits: number;
  fuel: number;
  fuelMax: number;
  lives: number;
  stage: number;
  chapterTitle: string;
  combo: number;
  comboActive: boolean;
  speedKmh: number;
  powerUps: PowerUpHudInfo[];
  boss: BossHudInfo | null;
  missions: MissionHudInfo[];
  checkpointStage: number | null;
  runActive: boolean;
  canContinue: boolean;
  upgrades: Record<string, number>;
  settings: { muted: boolean; retro: boolean };
  campaignDone: boolean;
  gamepadConnected: boolean;
  localScores: ScoreEntry[];
}

export interface ScoreEntry {
  name: string;
  score: number;
  stage: number;
  date: string;
}

/** Dados persistidos no localStorage — progresso permanente do jogador. */
export interface ProfileData {
  version: number;
  credits: number;
  bestScore: number;
  upgrades: Record<string, number>;
  settings: {
    muted: boolean;
    retro: boolean;
  };
  campaignDone: boolean;
  localScores: ScoreEntry[];
}

/** Dados de uma partida em andamento (checkpoint salvo automaticamente). */
export interface RunSaveData {
  version: number;
  seed: number;
  stage: number;
  score: number;
  lives: number;
  missions: {
    id: string;
    progress: number;
    completed: boolean;
    rewardGiven: boolean;
  }[];
  savedAt: number;
}

export interface GameCallbacks {
  /** Chamado ~10x por segundo com o estado do HUD. */
  onHud: (hud: HudState) => void;
  /** Toasts (missões, checkpoints, vidas extras...). */
  onToast: (title: string, description?: string) => void;
  /** Mudança de estado do jogo (menu → playing etc.). */
  onStateChange: (state: GameState) => void;
}

export const POWERUP_INFO: Record<
  PowerUpKind,
  { label: string; color: string; duration: number; description: string }
> = {
  shield: {
    label: 'Escudo',
    color: '#38bdf8',
    duration: 6,
    description: 'Invencibilidade temporária',
  },
  triple: {
    label: 'Tiro Triplo',
    color: '#fbbf24',
    duration: 8,
    description: 'Três projéteis por disparo',
  },
  homing: {
    label: 'Míssil Teleguiado',
    color: '#c084fc',
    duration: 8,
    description: 'Projéteis perseguem inimigos',
  },
  turbo: {
    label: 'Turbo',
    color: '#fb923c',
    duration: 5,
    description: 'Velocidade muito maior',
  },
};
