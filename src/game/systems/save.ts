/**
 * River Raid Remaster — Persistência (localStorage)
 * ---------------------------------------------------
 * Correções em relação ao original (PDF):
 *  - Salvamento com versão e validação de forma (o original só fazia
 *    try/catch de JSON.parse, aceitando dados de formato arbitrário).
 *  - A partida salva é um checkpoint discreto {fase, pontos, vidas,
 *    missões, seed} — restaurar posição X/Y exata do jogador no meio do
 *    rio (original) era frágil e podia ressuscitar o jogador em cima de
 *    um inimigo.
 *  - A tecla de salvamento manual não é mais F5 (que recarrega a página
 *    no navegador!); o salvamento manual vive no menu de pausa.
 *
 * Endurecimento (revisão adversarial):
 *  - loadRun rejeita (e remove) saves com campos fora do domínio válido
 *    — antes, `typeof number` deixava passar stage 0/1e300 (trava o
 *    motor), score NaN (corrompia o profile para sempre) e missions
 *    ausente (TypeError → tela branca no continueRun).
 *  - loadProfile saneia campo a campo (credits/bestScore numéricos com
 *    clamp, upgrades limitados ao maxLevel, localScores filtrados,
 *    settings/campaignDone tipados) — antes, valores adulterados no
 *    localStorage viravam NaN no profile e davam upgrades grátis.
 */

import type { ProfileData, RunSaveData, ScoreEntry } from '../types';
import { UPGRADE_DEFS } from './upgrades';
import { MISSION_DEFS } from './missions';

const PROFILE_KEY = 'riverraid_remaster_profile_v1';
const RUN_KEY = 'riverraid_remaster_run_v1';

export const PROFILE_VERSION = 1;
export const RUN_VERSION = 1;

const MAX_SCORE_VALUE = 1_000_000_000;
const MAX_STAGE = 999;
const MAX_LIVES = 99;
const MAX_SEED = 0xffffffff;
const MAX_NAME_LEN = 16;
const MAX_LOCAL_SCORES = 10;

export function defaultProfile(): ProfileData {
  return {
    version: PROFILE_VERSION,
    credits: 0,
    bestScore: 0,
    upgrades: {},
    settings: { muted: false, retro: false },
    campaignDone: false,
    localScores: [],
  };
}

// ---------------------------------------------------------------------------
// Validadores (o "branch rejeitado" agora é completo e testado)
// ---------------------------------------------------------------------------

function isInt(v: unknown, min: number, max: number): v is number {
  return (
    typeof v === 'number' &&
    Number.isInteger(v) &&
    v >= min &&
    v <= max
  );
}

function isValidMissionEntry(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.id === 'string' &&
    MISSION_DEFS.some((d) => d.id === m.id) &&
    typeof m.progress === 'number' &&
    Number.isFinite(m.progress) &&
    m.progress >= 0 &&
    typeof m.completed === 'boolean' &&
    typeof m.rewardGiven === 'boolean'
  );
}

function isValidRun(data: unknown): data is RunSaveData {
  if (typeof data !== 'object' || data === null) return false;
  const r = data as Record<string, unknown>;
  return (
    r.version === RUN_VERSION &&
    isInt(r.seed, 0, MAX_SEED) &&
    isInt(r.stage, 1, MAX_STAGE) &&
    isInt(r.score, 0, MAX_SCORE_VALUE) &&
    isInt(r.lives, 1, MAX_LIVES) &&
    Array.isArray(r.missions) &&
    r.missions.every(isValidMissionEntry) &&
    typeof r.savedAt === 'number' &&
    Number.isFinite(r.savedAt)
  );
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(Math.max(Math.trunc(v), min), max);
}

function sanitizeScoreEntry(v: unknown): ScoreEntry | null {
  if (typeof v !== 'object' || v === null) return null;
  const s = v as Record<string, unknown>;
  if (
    typeof s.name !== 'string' ||
    s.name.length < 1 ||
    s.name.length > MAX_NAME_LEN ||
    !isInt(s.score, 0, MAX_SCORE_VALUE) ||
    !isInt(s.stage, 1, MAX_STAGE) ||
    typeof s.date !== 'string'
  ) {
    return null;
  }
  return { name: s.name, score: s.score, stage: s.stage, date: s.date };
}

function sanitizeProfile(data: unknown): ProfileData {
  const base = defaultProfile();
  if (typeof data !== 'object' || data === null) return base;
  const p = data as Record<string, unknown>;

  // upgrades: mantém apenas ids conhecidos, com nível clampado ao máximo
  // (valor presente mas inválido → nível 0)
  const upgrades: Record<string, number> = {};
  if (typeof p.upgrades === 'object' && p.upgrades !== null) {
    for (const def of UPGRADE_DEFS) {
      const raw = (p.upgrades as Record<string, unknown>)[def.id];
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        if (raw !== undefined) upgrades[def.id] = 0;
        continue;
      }
      upgrades[def.id] = Math.min(
        Math.max(Math.trunc(raw), 0),
        def.maxLevel
      );
    }
  }

  const settingsIn =
    typeof p.settings === 'object' && p.settings !== null
      ? (p.settings as Record<string, unknown>)
      : {};

  const localScores = Array.isArray(p.localScores)
    ? p.localScores
        .map(sanitizeScoreEntry)
        .filter((s): s is ScoreEntry => s !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_LOCAL_SCORES)
    : [];

  return {
    version: PROFILE_VERSION,
    credits: clampInt(p.credits, 0, MAX_SCORE_VALUE, 0),
    bestScore: clampInt(p.bestScore, 0, MAX_SCORE_VALUE, 0),
    upgrades,
    settings: {
      muted: settingsIn.muted === true,
      retro: settingsIn.retro === true,
    },
    campaignDone: p.campaignDone === true,
    localScores,
  };
}

// ---------------------------------------------------------------------------
// Sistema de persistência
// ---------------------------------------------------------------------------

export class SaveSystem {
  loadProfile(): ProfileData {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return defaultProfile();
      const data = JSON.parse(raw) as unknown;
      if (
        typeof data !== 'object' ||
        data === null ||
        (data as Record<string, unknown>).version !== PROFILE_VERSION
      ) {
        return defaultProfile();
      }
      return sanitizeProfile(data);
    } catch {
      return defaultProfile();
    }
  }

  saveProfile(profile: ProfileData): void {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // armazenamento indisponível (modo privado etc.) — ignora
    }
  }

  loadRun(): RunSaveData | null {
    try {
      const raw = localStorage.getItem(RUN_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as unknown;
      if (!isValidRun(data)) {
        // Dado corrompido/adulterado: remove para auto-recuperação
        localStorage.removeItem(RUN_KEY);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  saveRun(run: RunSaveData): void {
    try {
      localStorage.setItem(RUN_KEY, JSON.stringify(run));
    } catch {
      // ignora
    }
  }

  clearRun(): void {
    try {
      localStorage.removeItem(RUN_KEY);
    } catch {
      // ignora
    }
  }
}
