'use client';

/**
 * Tela de fim de jogo: resumo da partida, créditos ganhos, envio da
 * pontuação ao ranking global e ranking local.
 */

import { useEffect, useState } from 'react';
import { Crosshair, Home, RotateCcw, Send, Skull, Trophy } from 'lucide-react';
import type { HudState } from '@/game/types';
import type { LastRunSummary } from '@/game/Game';
import { formatScore } from '@/game/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Leaderboard } from './Leaderboard';
import { cn } from '@/lib/utils';

const NAME_KEY = 'riverraid_player_name';

export function GameOverScreen({
  hud,
  lastRun,
  onRestart,
  onMenu,
}: {
  hud: HudState;
  lastRun: LastRunSummary | null;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const [name, setName] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [rank, setRank] = useState<number | null>(null);
  const [showBoard, setShowBoard] = useState(false);

  useEffect(() => {
    try {
      setName(localStorage.getItem(NAME_KEY) ?? '');
    } catch {
      // ignora
    }
  }, []);

  const isNewRecord = lastRun != null && lastRun.score >= hud.hiScore && lastRun.score > 0;

  const submit = async () => {
    const trimmed = name.trim().slice(0, 16);
    if (!trimmed || !lastRun || submitState === 'sending') return;
    setSubmitState('sending');
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          score: lastRun.score,
          stage: lastRun.stage,
          kills: lastRun.kills,
        }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { rank: number };
      setRank(data.rank);
      setSubmitState('done');
      try {
        localStorage.setItem(NAME_KEY, trimmed);
      } catch {
        // ignora
      }
    } catch {
      setSubmitState('error');
    }
  };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Fim de jogo"
    >
      <div className="flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl border border-red-500/25 bg-[#12060a]/95 p-6 shadow-2xl">
        <header className="text-center">
          <h2 className="flex items-center justify-center gap-2 font-mono text-2xl font-black tracking-wide text-red-400">
            <Skull className="size-6" /> FIM DE JOGO
          </h2>
          {isNewRecord && (
            <p className="mt-1 animate-pulse text-xs font-semibold uppercase tracking-widest text-amber-400">
              ★ Novo recorde! ★
            </p>
          )}
        </header>

        {/* Resumo */}
        {lastRun && (
          <div className="grid grid-cols-2 gap-2 text-center">
            <Stat
              icon={<Trophy className="size-4 text-amber-400" />}
              label="Pontuação"
              value={formatScore(lastRun.score)}
            />
            <Stat
              icon={<span className="text-sm">🌊</span>}
              label="Fase alcançada"
              value={String(lastRun.stage)}
            />
            <Stat
              icon={<Crosshair className="size-4 text-red-400" />}
              label="Abates"
              value={String(lastRun.kills)}
            />
            <Stat
              icon={<span className="text-sm">⬤</span>}
              label="Créditos ganhos"
              value={`+${formatScore(lastRun.credits)}`}
              accent
            />
          </div>
        )}

        {/* Envio ao ranking global */}
        {!showBoard && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            {submitState === 'done' ? (
              <p className="flex items-center justify-center gap-2 text-sm text-emerald-400">
                <Trophy className="size-4" />
                Enviado! Posição no ranking global:{' '}
                <strong className="font-mono">#{rank}</strong>
              </p>
            ) : (
              <>
                <label
                  htmlFor="player-name"
                  className="mb-1.5 block text-xs font-medium text-slate-300"
                >
                  Enviar pontuação ao ranking global
                </label>
                <div className="flex gap-2">
                  <Input
                    id="player-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome de piloto"
                    maxLength={16}
                    className="bg-black/40"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submit();
                    }}
                  />
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={!name.trim() || submitState === 'sending'}
                    onClick={() => void submit()}
                  >
                    <Send className="size-3.5" />
                    {submitState === 'sending' ? 'Enviando…' : 'Enviar'}
                  </Button>
                </div>
                {submitState === 'error' && (
                  <p className="mt-1.5 text-xs text-red-300">
                    Falha ao enviar. Verifique sua conexão e tente novamente.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {showBoard && <Leaderboard localScores={hud.localScores} highlightScore={lastRun?.score ?? null} />}

        <div className="flex flex-col gap-2">
          <Button size="lg" className="gap-2" onClick={onRestart} autoFocus>
            <RotateCcw className="size-4" /> Jogar novamente
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={() => setShowBoard((s) => !s)}>
              <Trophy className="size-4" />
              {showBoard ? 'Ocultar ranking' : 'Ver ranking'}
            </Button>
            <Button variant="ghost" className="flex-1 gap-2" onClick={onMenu}>
              <Home className="size-4" /> Menu
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <div className={cn('flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-slate-400')}>
        {icon}
        {label}
      </div>
      <div
        className={cn(
          'font-mono text-lg font-bold tabular-nums',
          accent ? 'text-amber-300' : 'text-slate-100'
        )}
      >
        {value}
      </div>
    </div>
  );
}
