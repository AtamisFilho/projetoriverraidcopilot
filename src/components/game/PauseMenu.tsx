'use client';

/**
 * Menu de pausa: continuar, reiniciar, salvar e sair, missões em
 * andamento e configurações rápidas.
 */

import { MonitorPlay, Pause, Play, RotateCcw, Save, Volume2, VolumeX } from 'lucide-react';
import type { HudState } from '@/game/types';
import { Button } from '@/components/ui/button';

export function PauseMenu({
  hud,
  onResume,
  onRestart,
  onSaveAndExit,
  onToggleMute,
  onToggleRetro,
}: {
  hud: HudState;
  onResume: () => void;
  onRestart: () => void;
  onSaveAndExit: () => void;
  onToggleMute: () => void;
  onToggleRetro: () => void;
}) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Jogo pausado"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#04141b]/95 p-6 shadow-2xl">
        <h2 className="mb-1 flex items-center gap-2 font-mono text-lg font-bold text-slate-100">
          <Pause className="size-5 text-teal-300" /> Pausado
        </h2>
        <p className="mb-4 text-xs text-slate-400">
          Fase {hud.stage} · Checkpoint na fase {hud.checkpointStage ?? hud.stage}
        </p>

        {/* Missões em andamento */}
        <div className="mb-4 space-y-1.5">
          {hud.missions.map((m) => (
            <div key={m.id} className="text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className={m.completed ? 'text-emerald-400 line-through' : 'text-slate-300'}>
                  {m.description}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-slate-500 tabular-nums">
                  {m.completed
                    ? '✓'
                    : `${Math.floor(m.progress)}/${m.goal}`}
                </span>
              </div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${
                    m.completed ? 'bg-emerald-500' : 'bg-teal-400'
                  }`}
                  style={{ width: `${Math.min(100, (m.progress / m.goal) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <Button className="gap-2" onClick={onResume} autoFocus>
            <Play className="size-4" /> Continuar
          </Button>
          <Button variant="secondary" className="gap-2" onClick={onRestart}>
            <RotateCcw className="size-4" /> Reiniciar fase atual
          </Button>
          <Button variant="outline" className="gap-2" onClick={onSaveAndExit}>
            <Save className="size-4" /> Salvar e sair
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 gap-2 text-xs text-slate-300"
              onClick={onToggleMute}
            >
              {hud.settings.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              Som
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 gap-2 text-xs text-slate-300"
              onClick={onToggleRetro}
            >
              <MonitorPlay className="size-4" /> CRT
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
