/**
 * River Raid Remaster — Upgrades permanentes
 * --------------------------------------------
 * Upgrades do PDF (velocidade, taxa de tiro, eficiência de combustível,
 * duração do escudo), comprados com CRÉDITOS — moeda separada da pontuação.
 *
 * Correção de design: o original gastava a própria pontuação na loja,
 * destruindo o senso de progressão (a pontuação é um recorde, não uma
 * carteira). Aqui os créditos são ganhos ao fim de cada partida.
 */

import type { PlayerStats } from '../entities/player';

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    id: 'speed',
    name: 'Velocidade',
    description: 'Aumenta a velocidade da nave em 8% por nível',
    maxLevel: 5,
    baseCost: 150,
  },
  {
    id: 'fire_rate',
    name: 'Taxa de Tiro',
    description: 'Reduz o intervalo entre disparos',
    maxLevel: 5,
    baseCost: 180,
  },
  {
    id: 'fuel_efficiency',
    name: 'Eficiência de Combustível',
    description: 'Reduz o consumo de combustível em 8% por nível',
    maxLevel: 5,
    baseCost: 200,
  },
  {
    id: 'shield_duration',
    name: 'Duração do Escudo',
    description: '+1,5s de escudo por nível ao coletar o power-up',
    maxLevel: 3,
    baseCost: 220,
  },
];

export function upgradeCost(def: UpgradeDef, level: number): number {
  return def.baseCost * (level + 1);
}

/** Aplica os níveis de upgrade às estatísticas do jogador. */
export function applyUpgrades(
  stats: PlayerStats,
  levels: Record<string, number>
): void {
  const clampLevel = (id: string, def: (typeof UPGRADE_DEFS)[number]): number => {
    const raw = levels[id];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
    return Math.min(Math.max(Math.trunc(raw), 0), def.maxLevel);
  };

  const speedLv = clampLevel('speed', UPGRADE_DEFS[0]);
  const fireLv = clampLevel('fire_rate', UPGRADE_DEFS[1]);
  const fuelLv = clampLevel('fuel_efficiency', UPGRADE_DEFS[2]);
  const shieldLv = clampLevel('shield_duration', UPGRADE_DEFS[3]);

  stats.speed = 340 * (1 + speedLv * 0.08);
  stats.fireCooldown = Math.max(0.14, 0.26 - fireLv * 0.024);
  stats.fuelEfficiency = Math.max(0.55, 1 - fuelLv * 0.08);
  stats.shieldBonus = shieldLv * 1.5;
}
