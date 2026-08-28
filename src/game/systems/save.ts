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
 */

import type { ProfileData, RunSaveData } from '../types';

const PROFILE_KEY = 'riverraid_remaster_profile_v1';
const RUN_KEY = 'riverraid_remaster_run_v1';

export const PROFILE_VERSION = 1;
export const RUN_VERSION = 1;

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

export class SaveSystem {
  loadProfile(): ProfileData {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return defaultProfile();
      const data = JSON.parse(raw) as Partial<ProfileData>;
      if (data.version !== PROFILE_VERSION) return defaultProfile();
      return {
        ...defaultProfile(),
        ...data,
        settings: { ...defaultProfile().settings, ...data.settings },
        upgrades: data.upgrades ?? {},
        localScores: Array.isArray(data.localScores) ? data.localScores : [],
      };
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
      const data = JSON.parse(raw) as Partial<RunSaveData>;
      if (data.version !== RUN_VERSION) {
        localStorage.removeItem(RUN_KEY);
        return null;
      }
      if (typeof data.stage !== 'number' || typeof data.score !== 'number') {
        localStorage.removeItem(RUN_KEY);
        return null;
      }
      return data as RunSaveData;
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
