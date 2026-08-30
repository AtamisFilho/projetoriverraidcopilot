"use client";

import { useEffect, useState } from "react";
import {
  Gamepad2,
  Keyboard,
  Layers,
  Minus,
  MonitorSmartphone,
  Plane,
  Play,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BriefingSection } from "./BriefingSection";
import { RankingPanel } from "./RankingPanel";
import { SpritePreview } from "./SpritePreview";
import {
  clearRun,
  describeSaveAge,
  loadConfig,
  loadRun,
  saveConfig,
  type GameConfig,
  type RunSave,
} from "@/lib/game/save";
import type { StartOptions } from "@/lib/game/types";

/* =========================================================================
 * TELA INICIAL — hero + CONFIGURAÇÃO DA MISSÃO (naves/nível/continuar) +
 * BRIEFING (apresentação de inimigos, obstáculos e itens) + ranking + rodapé.
 * ========================================================================= */

export function MenuScreen({
  onPlay,
  onContinue,
}: {
  onPlay: (cfg: StartOptions) => void;
  onContinue: (save: RunSave) => void;
}) {
  const [config, setConfig] = useState<GameConfig>({ lives: 3, startLevel: 1 });
  const [run, setRun] = useState<RunSave | null>(null);

  // carrega configuração e progresso salvos após a hidratação
  useEffect(() => {
    const id = window.setTimeout(() => {
      setConfig(loadConfig());
      setRun(loadRun());
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const updateConfig = (patch: Partial<GameConfig>) => {
    setConfig((c) => {
      const next = { ...c, ...patch };
      saveConfig(next);
      return next;
    });
  };

  const deleteSave = () => {
    clearRun();
    setRun(null);
  };

  const scrollToRanking = () => {
    document.getElementById("ranking")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="min-h-dvh w-full flex flex-col bg-gradient-to-b from-background via-background to-[#0a1a14] relative overflow-x-hidden">
      {/* brilho decorativo de fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[420px] rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 -right-32 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl"
      />

      <main className="flex-1 flex flex-col items-center pt-10 pb-4 relative z-10">
        {/* ---------------- HERO ---------------- */}
        <header className="text-center px-4 mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1 text-[11px] font-black tracking-widest text-primary mb-4">
            <MonitorSmartphone className="size-3.5" aria-hidden />
            PROJETO COPILOT · REMASTER HD
          </div>
          <h1 className="text-5xl sm:text-7xl font-black tracking-tighter leading-[0.95]">
            <span className="bg-gradient-to-r from-primary via-emerald-300 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(52,211,153,0.25)]">
              RIVER RAID
            </span>
          </h1>
          <div className="mt-1 text-2xl sm:text-4xl font-black tracking-[0.35em] text-foreground/85">
            REMASTER
          </div>
          <p className="text-sm sm:text-base text-muted-foreground mt-4 max-w-md mx-auto leading-relaxed">
            O clássico de 1982 renasce: <strong className="text-foreground/90">gráficos HD</strong>,
            níveis de 1–2 minutos com dificuldade crescente, 8 inimigos, 3 chefes,
            checkpoint automático e alerta sonoro de combustível crítico.
          </p>

          {/* jato flutuante decorativo */}
          <div className="mt-5 flex justify-center">
            <div className="float-ship">
              <SpritePreview id="player" size={120} zoom={1.35} />
            </div>
          </div>

          {/* CTAs — CONTINUAR tem prioridade quando existe progresso salvo */}
          <div className="mt-6 flex flex-col items-center justify-center gap-3">
            {run ? (
              <div className="w-full max-w-md flex flex-col sm:flex-row items-stretch justify-center gap-3">
                <Button size="xl" onClick={() => onContinue(run)} className="flex-1 shadow-xl">
                  <RotateCcw className="size-5" strokeWidth={3} aria-hidden />
                  CONTINUAR — NÍVEL {run.level}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => onPlay({ level: config.startLevel, lives: config.lives })}
                  className="sm:w-48"
                >
                  <Play className="size-4" aria-hidden />
                  NOVA MISSÃO
                </Button>
              </div>
            ) : (
              <Button
                size="xl"
                onClick={() => onPlay({ level: config.startLevel, lives: config.lives })}
                className="w-64 sm:w-auto shadow-xl"
              >
                <Play className="size-5" strokeWidth={3} aria-hidden />
                INICIAR MISSÃO
              </Button>
            )}
            {run && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap justify-center">
                <span className="font-bold text-foreground/80 tabular-nums">
                  {run.score.toLocaleString("pt-BR")} pts
                </span>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{run.distanceM.toLocaleString("pt-BR")} m</span>
                <span aria-hidden>·</span>
                <span>salvo {describeSaveAge(run.ts)}</span>
                <button
                  onClick={deleteSave}
                  className="inline-flex items-center gap-1 text-muted-foreground/70 hover:text-red-400 underline underline-offset-2 cursor-pointer"
                  aria-label="Apagar progresso salvo"
                >
                  <Trash2 className="size-3" aria-hidden />
                  apagar
                </button>
              </p>
            )}
            <Button size="lg" variant="outline" onClick={scrollToRanking} className="w-64 sm:w-auto">
              <Trophy className="size-4 text-amber-400" aria-hidden />
              RANKING GLOBAL
            </Button>
          </div>
        </header>

        {/* ---------------- CONFIGURAÇÃO DA MISSÃO ---------------- */}
        <section className="w-full max-w-md px-4 pb-6" aria-label="Configuração da missão">
          <div className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-3 justify-center">
              <Save className="size-4 text-primary" aria-hidden />
              <h2 className="text-xs font-black tracking-widest text-foreground/90">
                CONFIGURAÇÃO DA MISSÃO
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Stepper
                label="NAVES"
                icon={<Plane className="size-3.5 text-primary" aria-hidden />}
                value={config.lives}
                min={1}
                max={6}
                onChange={(v) => updateConfig({ lives: v })}
                hint="quantas pode perder"
              />
              <Stepper
                label="NÍVEL INICIAL"
                icon={<Layers className="size-3.5 text-primary" aria-hidden />}
                value={config.startLevel}
                min={1}
                max={50}
                onChange={(v) => updateConfig({ startLevel: v })}
                hint="dificuldade de partida"
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2.5 leading-relaxed">
              Cada nível dura de 1 a 2 minutos e a dificuldade cresce a ponte que
              passa. Ao perder todas as naves ou pausar, o progresso fica salvo —
              depois é possível continuar do mesmo ponto.
            </p>
          </div>
        </section>

        {/* ---------------- BRIEFING (apresentação na tela inicial) ---------------- */}
        <BriefingSection />

        {/* ---------------- RANKING ---------------- */}
        <div className="w-full max-w-4xl px-4 pb-10 pt-2">
          <RankingPanel />
        </div>

        {/* ---------------- CONTROLES ---------------- */}
        <section className="w-full max-w-4xl px-4 pb-10" aria-label="Controles">
          <h2 className="text-lg font-black text-foreground mb-4 text-center">CONTROLES</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/70 bg-card/60 backdrop-blur p-4 text-center">
              <Keyboard className="size-6 mx-auto text-primary mb-2" aria-hidden />
              <h3 className="font-black text-sm">TECLADO</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                <kbd className="px-1.5 py-0.5 rounded bg-secondary font-mono text-[10px]">←</kbd>{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-secondary font-mono text-[10px]">→</kbd> mover ·{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-secondary font-mono text-[10px]">↑</kbd>{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-secondary font-mono text-[10px]">↓</kbd>{" "}
                velocidade ·{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-secondary font-mono text-[10px]">ESPAÇO</kbd>{" "}
                atirar ·{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-secondary font-mono text-[10px]">K</kbd>{" "}
                pulso EMP ·{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-secondary font-mono text-[10px]">P</kbd>{" "}
                pausar
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/60 backdrop-blur p-4 text-center">
              <Gamepad2 className="size-6 mx-auto text-primary mb-2" aria-hidden />
              <h3 className="font-black text-sm">JOYSTICK</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Xbox, PlayStation e genéricos via <strong>Gamepad API</strong> — conecte e use o
                analógico, <em>d-pad</em>, A/R2 para atirar e Start para pausar.
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/60 backdrop-blur p-4 text-center">
              <MonitorSmartphone className="size-6 mx-auto text-primary mb-2" aria-hidden />
              <h3 className="font-black text-sm">TOQUE</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Em celulares e tablets o <strong>joystick digital</strong>, o botão{" "}
                <strong>TIRO</strong> e o <strong>GATILHO</strong> ficam numa barra na parte
                inferior da tela — o dedo nunca cobre o rio. Para reposicionar, arraste-os{" "}
                <strong>antes de decolar ou com o jogo pausado</strong>.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ---------------- RODAPÉ FIXO ---------------- */}
      <footer className="mt-auto border-t border-border/60 bg-card/60 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-bold">
            River Raid Remaster — Projeto Copilot · Next.js + Canvas 2D
          </span>
          <span>
            Remasterização educacional do clássico da Activision® (1982) · Sem fins comerciais
          </span>
        </div>
      </footer>
    </div>
  );
}

/* ---------------------------- seletor numérico ---------------------------- */

function Stepper({
  label,
  icon,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  hint: string;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-background/40 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] font-black tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="flex items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={dec}
          disabled={value <= min}
          aria-label={`Diminuir ${label.toLowerCase()}`}
          className="size-9 rounded-lg border border-border/70 bg-card/80 flex items-center justify-center hover:bg-secondary/70 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <span className="text-2xl font-black tabular-nums text-foreground min-w-8 text-center">
          {value}
        </span>
        <button
          type="button"
          onClick={inc}
          disabled={value >= max}
          aria-label={`Aumentar ${label.toLowerCase()}`}
          className="size-9 rounded-lg border border-border/70 bg-card/80 flex items-center justify-center hover:bg-secondary/70 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
      <span className="text-[9px] text-muted-foreground/80 text-center">{hint}</span>
    </div>
  );
}
