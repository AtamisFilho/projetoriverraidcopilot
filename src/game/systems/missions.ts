/**
 * River Raid Remaster — Missões
 * -------------------------------
 * Missões do PDF (destruir 20 inimigos, coletar 5 combustíveis, sobreviver
 * 60s) + duas extras (primeiro chefe, combo x3), com recompensas.
 *
 * Correção: `rewardGiven` agora é inicializado explicitamente (no original
 * funcionava por acidente, pois `undefined` é falsy).
 */

import type { MissionHudInfo, PowerUpKind } from '../types';

export interface MissionDef {
  id: string;
  description: string;
  goal: number;
  reward: {
    score?: number;
    fuel?: number;
    powerup?: PowerUpKind;
  };
  rewardText: string;
  rewardPowerup?: PowerUpKind;
}

interface MissionState extends MissionDef {
  progress: number;
  completed: boolean;
  rewardGiven: boolean;
}

export const MISSION_DEFS: MissionDef[] = [
  {
    id: 'destroy_20',
    description: 'Destrua 20 inimigos',
    goal: 20,
    reward: { score: 500, fuel: 30 },
    rewardText: '+500 pts e +30 combustível',
  },
  {
    id: 'collect_5_fuel',
    description: 'Colete 5 tanques de combustível',
    goal: 5,
    reward: { score: 300, powerup: 'turbo' },
    rewardText: '+300 pts e Turbo',
    rewardPowerup: 'turbo',
  },
  {
    id: 'survive_60',
    description: 'Sobreviva por 60 segundos',
    goal: 60,
    reward: { score: 800, powerup: 'shield' },
    rewardText: '+800 pts e Escudo',
    rewardPowerup: 'shield',
  },
  {
    id: 'first_boss',
    description: 'Derrote o primeiro chefe',
    goal: 1,
    reward: { score: 1000, fuel: 40 },
    rewardText: '+1000 pts e +40 combustível',
  },
  {
    id: 'combo_x3',
    description: 'Alcance combo x3',
    goal: 1,
    reward: { score: 300 },
    rewardText: '+300 pts',
  },
];

export class MissionSystem {
  list: MissionState[] = MISSION_DEFS.map((d) => ({
    ...d,
    progress: 0,
    completed: false,
    rewardGiven: false,
  }));

  progress(id: string, amount = 1): void {
    const m = this.list.find((x) => x.id === id);
    if (!m || m.completed) return;
    const next = m.progress + amount;
    m.progress = Math.min(m.goal, next);
    // Tolerância numérica: a soma FP de 0,01×6000 estaciona em
    // 59,99999999999663 (o incremento arredonda para baixo no double) —
    // sem o épsilon a missão "sobreviva 60s" nunca completaria.
    const EPS = 1e-6;
    if (m.progress >= m.goal - EPS || next >= m.goal - EPS) {
      m.progress = m.goal;
      m.completed = true;
    }
  }

  /** Missão de combo chega instantaneamente ao alvo. */
  complete(id: string): void {
    const m = this.list.find((x) => x.id === id);
    if (!m || m.completed) return;
    m.progress = m.goal;
    m.completed = true;
  }

  update(dt: number): void {
    this.progress('survive_60', dt);
  }

  /** Retorna missões recém-concluídas (recompensa ainda não entregue). */
  popCompleted(): MissionState[] {
    return this.list.filter((m) => m.completed && !m.rewardGiven);
  }

  markRewarded(m: MissionState): void {
    m.rewardGiven = true;
  }

  toHud(): MissionHudInfo[] {
    return this.list.map((m) => ({
      id: m.id,
      description: m.description,
      progress: m.progress,
      goal: m.goal,
      completed: m.completed,
      reward: m.rewardText,
    }));
  }

  /** Estado para salvar a partida em andamento. */
  serialize(): { id: string; progress: number; completed: boolean; rewardGiven: boolean }[] {
    return this.list.map((m) => ({
      id: m.id,
      progress: m.progress,
      completed: m.completed,
      rewardGiven: m.rewardGiven,
    }));
  }

  restore(data: { id: string; progress: number; completed: boolean; rewardGiven: boolean }[]): void {
    // Defesa: dados restaurados podem vir corrompidos/adulterados
    if (!Array.isArray(data)) return;
    for (const saved of data) {
      if (typeof saved !== 'object' || saved === null) continue;
      if (
        typeof saved.id !== 'string' ||
        typeof saved.progress !== 'number' ||
        !Number.isFinite(saved.progress) ||
        saved.progress < 0 ||
        typeof saved.completed !== 'boolean' ||
        typeof saved.rewardGiven !== 'boolean'
      ) {
        continue; // entrada inválida: ignora sem corromper o restante
      }
      const m = this.list.find((x) => x.id === saved.id);
      if (m) {
        m.progress = Math.min(m.goal, saved.progress);
        // progress já no objetivo ⇒ concluída (dados adulterados com
        // progress=goal e completed=false não podem travar a missão)
        m.completed = saved.completed || m.progress >= m.goal;
        m.rewardGiven = saved.rewardGiven;
      }
    }
  }
}
