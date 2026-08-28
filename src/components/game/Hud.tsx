'use client';

/**
 * HUD minimalista e elegante (conforme a especificação do PDF):
 * pontuação, combustível, vidas, velocidade, combo, power-ups ativos,
 * barra de vida do chefe e progresso das missões.
 */

import {
  Fuel,
  Gauge,
  Heart,
  Trophy,
  Swords,
  Crosshair,
  Shield,
  Zap,
  Sparkles,
} from 'lucide-react';
import type { HudState, PowerUpKind } from '@/game/types';
import { POWERUP_INFO } from '@/game/types';
import { formatScore } from '@/game/utils';
import { cn } from '@/lib/utils';

const POWERUP_ICONS: Record<PowerUpKind, React.ComponentType<{ className?: string }>> = {
  shield: Shield,
  triple: Zap,
  homing: Crosshair,
  turbo: Sparkles,
};

export function Hud({ hud }: { hud: HudState }) {
  const fuelPct = Math.max(0, Math.min(1, hud.fuel / hud.fuelMax));
  const lowFuel = fuelPct < 0.25;

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* Barra superior */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-4">
        {/* Pontuação */}
        <div className="rounded-lg border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-300">
            <Trophy className="size-3 text-amber-400" />
            Pontos
          </div>
          <div className="font-mono text-xl font-bold leading-6 text-white tabular-nums sm:text-2xl">
            {formatScore(hud.score)}
          </div>
          <div className="font-mono text-[10px] text-slate-400 tabular-nums">
            recorde {formatScore(hud.hiScore)}
          </div>
        </div>

        {/* Fase / capítulo */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="rounded-lg border border-teal-400/20 bg-black/50 px-3 py-1.5 text-center backdrop-blur-sm">
            <div className="text-[10px] font-medium uppercase tracking-wider text-teal-300">
              Fase {hud.stage}
            </div>
            <div className="max-w-44 truncate text-[10px] text-slate-300 sm:max-w-64">
              {hud.chapterTitle}
            </div>
          </div>

          {/* Combo */}
          {hud.comboActive && (
            <div
              className={cn(
                'animate-pulse rounded-full border px-3 py-1 font-mono text-xs font-bold backdrop-blur-sm',
                hud.combo >= 3
                  ? 'border-amber-400/50 bg-amber-500/20 text-amber-300'
                  : 'border-teal-400/40 bg-teal-500/15 text-teal-200'
              )}
            >
              COMBO ×{hud.combo.toFixed(1)}
            </div>
          )}

          {/* Barra de vida do chefe */}
          {hud.boss && (
            <div className="w-56 rounded-lg border border-red-500/30 bg-black/60 px-3 py-2 backdrop-blur-sm sm:w-72">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-red-300">
                <span className="flex items-center gap-1">
                  <Swords className="size-3" />
                  {hud.boss.name}
                </span>
                <span className="font-mono tabular-nums">
                  {Math.ceil((hud.boss.hp / hud.boss.maxHp) * 100)}%
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-600 via-red-500 to-orange-400 transition-[width] duration-150"
                  style={{ width: `${(hud.boss.hp / hud.boss.maxHp) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Vidas + créditos */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="rounded-lg border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-sm">
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(hud.lives, 6) }).map((_, i) => (
                <Heart
                  key={i}
                  className="size-3.5 fill-red-500 text-red-500"
                  aria-hidden
                />
              ))}
              {hud.lives > 6 && (
                <span className="font-mono text-[10px] text-red-300">
                  +{hud.lives - 6}
                </span>
              )}
            </div>
            <div className="mt-1 font-mono text-[10px] text-slate-400 tabular-nums">
              ⬤ {formatScore(hud.credits)} créditos
            </div>
          </div>
        </div>
      </div>

      {/* Parte inferior */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 sm:p-4">
        {/* Combustível */}
        <div className="w-40 rounded-lg border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-sm sm:w-52">
          <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider">
            <span className={cn('flex items-center gap-1', lowFuel ? 'text-red-400' : 'text-slate-300')}>
              <Fuel className="size-3" />
              Combustível
            </span>
            <span
              className={cn(
                'font-mono tabular-nums',
                lowFuel ? 'animate-pulse text-red-400' : 'text-slate-300'
              )}
            >
              {Math.round(fuelPct * 100)}%
            </span>
          </div>
          <div className="mt-1.5 h-3 overflow-hidden rounded-full border border-white/10 bg-slate-900/80">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-150',
                lowFuel
                  ? 'bg-gradient-to-r from-red-600 to-red-400'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-400'
              )}
              style={{ width: `${fuelPct * 100}%` }}
            />
          </div>
        </div>

        {/* Power-ups ativos */}
        <div className="flex flex-col items-center gap-1">
          {hud.powerUps.map((p) => {
            const info = POWERUP_INFO[p.kind];
            const Icon = POWERUP_ICONS[p.kind];
            const pct = Math.max(0, Math.min(1, p.timeLeft / p.duration));
            return (
              <div
                key={p.kind}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-black/50 py-1 pl-2 pr-3 backdrop-blur-sm"
              >
                <span
                  className="grid size-5 place-items-center rounded-full"
                  style={{ backgroundColor: `${info.color}26` }}
                >
                  <Icon className="size-3" style={{ color: info.color }} />
                </span>
                <span className="text-[10px] font-medium text-slate-200">
                  {info.label}
                </span>
                <span className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-800">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${pct * 100}%`, backgroundColor: info.color }}
                  />
                </span>
              </div>
            );
          })}
        </div>

        {/* Velocidade */}
        <div className="rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-right backdrop-blur-sm">
          <div className="flex items-center justify-end gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-300">
            <Gauge className="size-3 text-teal-300" />
            Velocidade
          </div>
          <div className="font-mono text-lg font-bold leading-5 text-white tabular-nums">
            {hud.speedKmh}
            <span className="ml-1 text-[10px] font-normal text-slate-400">km/h</span>
          </div>
        </div>
      </div>
    </div>
  );
}
