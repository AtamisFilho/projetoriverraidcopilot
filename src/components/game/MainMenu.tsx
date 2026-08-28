'use client';

/**
 * Menu principal: nova partida, continuar, hangar (upgrades permanentes),
 * ranking, instruções e configurações (som / modo retro CRT).
 */

import { useState } from 'react';
import {
  ChevronRight,
  Gamepad2,
  MonitorPlay,
  Play,
  RotateCcw,
  ShoppingBag,
  Trophy,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import type { HudState } from '@/game/types';
import { UPGRADE_DEFS, upgradeCost } from '@/game/systems/upgrades';
import { formatScore } from '@/game/utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Leaderboard } from './Leaderboard';

export function MainMenu({
  hud,
  onNewGame,
  onContinue,
  onToggleMute,
  onToggleRetro,
  onBuyUpgrade,
}: {
  hud: HudState;
  onNewGame: () => void;
  onContinue: () => void;
  onToggleMute: () => void;
  onToggleRetro: () => void;
  onBuyUpgrade: (id: string) => boolean;
}) {
  const [panel, setPanel] = useState<'none' | 'hangar' | 'ranking' | 'howto'>('none');

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-black/70 via-black/55 to-black/80 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl border border-white/10 bg-[#04141b]/90 p-6 shadow-2xl">
        {/* Título */}
        <header className="text-center">
          <h1 className="bg-gradient-to-b from-teal-200 via-teal-300 to-emerald-500 bg-clip-text font-mono text-4xl font-black tracking-tight text-transparent sm:text-5xl">
            RIVER RAID
          </h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.5em] text-amber-400">
            Remaster
          </p>
          <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-slate-400">
            <span>
              Recorde <strong className="font-mono text-slate-200">{formatScore(hud.hiScore)}</strong>
            </span>
            <span aria-hidden>·</span>
            <span>
              <strong className="font-mono text-slate-200">{formatScore(hud.credits)}</strong> créditos
            </span>
            {hud.campaignDone && (
              <>
                <span aria-hidden>·</span>
                <span className="text-amber-400">★ campanha concluída</span>
              </>
            )}
          </div>
        </header>

        {panel === 'none' && (
          <nav className="flex flex-col gap-2" aria-label="Menu principal">
            <Button size="lg" className="gap-2 text-base" onClick={onNewGame}>
              <Play className="size-4" /> Novo jogo
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="gap-2"
              onClick={onContinue}
              disabled={!hud.canContinue}
            >
              <RotateCcw className="size-4" /> Continuar partida
            </Button>
            <div className="mt-1 grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                className="flex-col gap-1 py-3 text-xs"
                onClick={() => setPanel('hangar')}
              >
                <Wrench className="size-4" /> Hangar
              </Button>
              <Button
                variant="outline"
                className="flex-col gap-1 py-3 text-xs"
                onClick={() => setPanel('ranking')}
              >
                <Trophy className="size-4" /> Ranking
              </Button>
              <Button
                variant="outline"
                className="flex-col gap-1 py-3 text-xs"
                onClick={() => setPanel('howto')}
              >
                <Gamepad2 className="size-4" /> Controles
              </Button>
            </div>

            {/* Configurações rápidas */}
            <div className="mt-1 flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 gap-2 text-xs text-slate-300"
                onClick={onToggleMute}
                aria-pressed={hud.settings.muted}
              >
                {hud.settings.muted ? (
                  <VolumeX className="size-4" />
                ) : (
                  <Volume2 className="size-4" />
                )}
                Som {hud.settings.muted ? 'desligado' : 'ligado'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 gap-2 text-xs text-slate-300"
                onClick={onToggleRetro}
                aria-pressed={hud.settings.retro}
              >
                <MonitorPlay className="size-4" />
                CRT {hud.settings.retro ? 'ligado' : 'desligado'}
              </Button>
            </div>

            {hud.gamepadConnected && (
              <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-emerald-400">
                <Gamepad2 className="size-3.5" /> Controle conectado
              </p>
            )}
          </nav>
        )}

        {panel === 'hangar' && (
          <section aria-label="Hangar de upgrades">
            <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-100">
              <Wrench className="size-4 text-amber-400" /> Hangar
            </h2>
            <p className="mb-3 text-xs text-slate-400">
              Upgrades permanentes comprados com créditos (ganhos ao fim de
              cada partida). Créditos atuais:{' '}
              <strong className="font-mono text-amber-300">{formatScore(hud.credits)}</strong>
            </p>
            <div className="space-y-2">
              {UPGRADE_DEFS.map((def) => {
                const level = hud.upgrades[def.id] ?? 0;
                const maxed = level >= def.maxLevel;
                const cost = upgradeCost(def, level);
                const affordable = hud.credits >= cost;
                return (
                  <div
                    key={def.id}
                    className="rounded-lg border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-100">
                            {def.name}
                          </span>
                          <span className="flex gap-0.5" aria-hidden>
                            {Array.from({ length: def.maxLevel }).map((_, i) => (
                              <span
                                key={i}
                                className={cn(
                                  'h-1.5 w-3 rounded-full',
                                  i < level ? 'bg-amber-400' : 'bg-white/15'
                                )}
                              />
                            ))}
                          </span>
                        </div>
                        <p className="truncate text-[11px] text-slate-400">
                          {def.description}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={maxed ? 'ghost' : affordable ? 'default' : 'outline'}
                        disabled={maxed || !affordable}
                        onClick={() => onBuyUpgrade(def.id)}
                        className="shrink-0 gap-1 text-xs"
                      >
                        {maxed ? (
                          'Máx.'
                        ) : (
                          <>
                            <ShoppingBag className="size-3" />
                            {cost}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full gap-1 text-xs text-slate-400"
              onClick={() => setPanel('none')}
            >
              Voltar
            </Button>
          </section>
        )}

        {panel === 'ranking' && (
          <section aria-label="Ranking">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-100">
              <Trophy className="size-4 text-amber-400" /> Ranking
            </h2>
            <Leaderboard localScores={hud.localScores} />
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full gap-1 text-xs text-slate-400"
              onClick={() => setPanel('none')}
            >
              Voltar
            </Button>
          </section>
        )}

        {panel === 'howto' && (
          <section aria-label="Como jogar">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-100">
              <Gamepad2 className="size-4 text-teal-300" /> Como jogar
            </h2>
            <ul className="space-y-2 text-xs leading-relaxed text-slate-300">
              <li>
                <strong className="text-slate-100">Objetivo:</strong> voe pelo
                rio, destrua pontes para avançar de fase e derrote os chefes
                das fases 3, 6 e 9.
              </li>
              <li>
                <strong className="text-slate-100">Combustível:</strong> encoste
                nos depósios verdes (★ dourado = bônus). Cuidado com tanques
                falsos (listrados) a partir da fase 5.
              </li>
              <li>
                <strong className="text-slate-100">Margens:</strong> tocar na
                terra é fatal — como no clássico.
              </li>
              <li>
                <strong className="text-slate-100">Teclado:</strong> WASD/setas
                movem · <kbd className="rounded bg-white/10 px-1">Espaço</kbd>{' '}
                atira · <kbd className="rounded bg-white/10 px-1">P</kbd> pausa ·{' '}
                <kbd className="rounded bg-white/10 px-1">M</kbd> som.
              </li>
              <li>
                <strong className="text-slate-100">Gamepad:</strong> analógico
                esquerdo move, A/X atira, Start pausa.
              </li>
              <li>
                <strong className="text-slate-100">Toque:</strong> joystick
                virtual à esquerda, botão de fogo à direita.
              </li>
              <li className="flex items-center gap-1 text-slate-400">
                <ChevronRight className="size-3 text-amber-400" />
                Acelerar para cima da tela aumenta a velocidade (e o risco).
              </li>
            </ul>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full gap-1 text-xs text-slate-400"
              onClick={() => setPanel('none')}
            >
              Voltar
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}
