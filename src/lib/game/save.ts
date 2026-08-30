/* =========================================================================
 * River Raid Remaster — Persistência local (localStorage)
 *
 * Dois blocos de estado sobrevivem ao fechamento do app:
 *  1. PROGRESSO DA ÚLTIMA PARTIDA (RunSave) — permite CONTINUAR do ponto
 *     exato em que o piloto parou ou perdeu (nível, distância, pontos…).
 *     Gravado ao pausar, ao sair para o menu e no fim de jogo.
 *  2. CONFIGURAÇÃO DA MISSÃO (GameConfig) — quantidade de naves que o
 *     piloto pode perder e nível inicial escolhido no menu.
 *
 * Tudo em try/catch: no APK (WebView file://) e em navegadores com
 * localStorage bloqueado o jogo continua funcionando — apenas não persiste.
 * ========================================================================= */

import { GAME_CONST as G } from "./types";

export const SAVE_KEY = "rr-save-v1";
export const CONFIG_KEY = "rr-config-v1";

/** Progresso salvo da última partida */
export interface RunSave {
  v: 1;
  /** nível em que a partida parou/terminou */
  level: number;
  /** ponto exato (metros) do rio em que a partida parou/terminou */
  distanceM: number;
  score: number;
  /** naves restantes (0 quando o fim de jogo aconteceu) */
  lives: number;
  chapter: number;
  enemiesKilled: number;
  fuelCollected: number;
  ts: number;
}

/** Configuração escolhida no menu (aplica-se a novas missões) */
export interface GameConfig {
  lives: number;
  startLevel: number;
}

const DEFAULT_CONFIG: GameConfig = { lives: G.lives, startLevel: 1 };

function storage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function clampInt(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/* ------------------------------- progresso ------------------------------- */

export function loadRun(): RunSave | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(SAVE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<RunSave>;
    if (!p || typeof p !== "object") return null;
    return {
      v: 1,
      level: clampInt(p.level, G.levelMin, G.levelMax, 1),
      distanceM: Math.max(0, Math.round(Number(p.distanceM) || 0)),
      score: Math.max(0, Math.round(Number(p.score) || 0)),
      lives: clampInt(p.lives, 0, G.livesMax, 0),
      chapter: clampInt(p.chapter, 1, 3, 1),
      enemiesKilled: Math.max(0, Math.round(Number(p.enemiesKilled) || 0)),
      fuelCollected: Math.max(0, Math.round(Number(p.fuelCollected) || 0)),
      ts: Number(p.ts) || Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveRun(r: RunSave): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(SAVE_KEY, JSON.stringify({ ...r, v: 1 }));
  } catch {
    /* cota cheia / modo privado: apenas não persiste */
  }
}

export function clearRun(): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(SAVE_KEY);
  } catch {
    /* ignora */
  }
}

/* ------------------------------ configuração ------------------------------ */

export function loadConfig(): GameConfig {
  const s = storage();
  if (!s) return { ...DEFAULT_CONFIG };
  try {
    const raw = s.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const p = JSON.parse(raw) as Partial<GameConfig>;
    return {
      lives: clampInt(p.lives, G.livesMin, G.livesMax, DEFAULT_CONFIG.lives),
      startLevel: clampInt(p.startLevel, G.levelMin, G.levelMax, DEFAULT_CONFIG.startLevel),
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(c: GameConfig): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(CONFIG_KEY, JSON.stringify(c));
  } catch {
    /* ignora */
  }
}

/** Amostra relativa da última partida para exibição ("há 2 h") */
export function describeSaveAge(ts: number): string {
  const min = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}
