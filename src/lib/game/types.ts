/* =========================================================================
 * River Raid Remaster — Tipos e constantes do motor
 * Coordenadas lógicas virtuais: 540 × 960 (render em alta resolução/DPR)
 * ========================================================================= */

export const VW = 540;
export const VH = 960;
export const ROW_H = 16;

export type EnemyType =
  | "patrol"
  | "balloon"
  | "drone"
  | "armored"
  | "chopper"
  | "jet"
  | "turret"
  | "stealth";

export type BossType = "destroyer" | "fortress" | "carrier";

export type PickupType =
  | "fuel"
  | "fuelGold"
  | "fakeFuel"
  | "shield"
  | "triple"
  | "homing"
  | "turbo";

export interface HudWeaponTimers {
  shield: number;
  triple: number;
  homing: number;
  turbo: number;
}

export interface HudState {
  score: number;
  combo: number;
  emp: number; // cargas do pulso EMP (gatilho especial)
  fuel: number; // 0..100
  fuelSeconds: number; // segundos restantes estimados
  fuelCritical: boolean; // <= 10s de combustível
  speedKmh: number;
  lives: number;
  chapter: number;
  chapterName: string;
  distanceM: number;
  weapons: HudWeaponTimers;
  bossActive: boolean;
  bossName: string;
  bossHpPct: number;
  paused: boolean;
}

export interface RunResult {
  score: number;
  distanceM: number;
  chapter: number;
  enemiesKilled: number;
  fuelCollected: number;
}

export interface GameCallbacks {
  onHud: (h: HudState) => void;
  onGameOver: (r: RunResult) => void;
  onChapterStart: (chapter: number, name: string) => void;
}

export interface InputState {
  left: boolean;
  right: boolean;
  accelerate: boolean;
  decelerate: boolean;
  fire: boolean;
}

export const GAME_CONST = {
  playerY: VH - 150,
  playerRadius: 13,
  playerAccel: 2000,
  playerMaxVx: 380,
  playerFriction: 6.5,
  scrollBase: 130,
  scrollMin: 85,
  scrollMax: 330,
  fuelMax: 100,
  fuelWarnSeconds: 10,
  fireRate: 7.5,
  bulletSpeed: 640,
  bulletRadius: 4,
  lives: 3,
  invulnOnSpawn: 2.5,
  empStart: 2, // cargas iniciais do pulso EMP
  empMax: 3, // máximo de cargas carregáveis
  empDamage: 3, // dano por pulso em inimigos comuns
  empBossDamage: 12, // dano fixo por pulso no chefe
  empCooldown: 0.6, // segundos entre pulsos
  chapterDistances: [0, 3000, 7000, 12000] as const,
  bridgeEvery: 2400, // metros entre pontes (portais de capítulo)
} as const;
