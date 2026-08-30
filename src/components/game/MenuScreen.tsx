"use client";

import { Gamepad2, Keyboard, MonitorSmartphone, Play, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BriefingSection } from "./BriefingSection";
import { RankingPanel } from "./RankingPanel";
import { SpritePreview } from "./SpritePreview";

/* =========================================================================
 * TELA INICIAL — hero + BRIEFING (apresentação de inimigos, obstáculos e
 * itens) + ações + rodapé fixo.
 * ========================================================================= */

export function MenuScreen({ onPlay }: { onPlay: () => void }) {
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
            rio procedural, 8 inimigos, 3 chefes e alerta sonoro de combustível crítico.
          </p>

          {/* jato flutuante decorativo */}
          <div className="mt-5 flex justify-center">
            <div className="float-ship">
              <SpritePreview id="player" size={120} zoom={1.35} />
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="xl" onClick={onPlay} className="w-64 sm:w-auto shadow-xl">
              <Play className="size-5" strokeWidth={3} aria-hidden />
              INICIAR MISSÃO
            </Button>
            <Button size="lg" variant="outline" onClick={scrollToRanking} className="w-64 sm:w-auto">
              <Trophy className="size-4 text-amber-400" aria-hidden />
              RANKING GLOBAL
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground mt-3">
            Role para baixo e estude o briefing antes de decolar ↓
          </p>
        </header>

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
                Em celulares e tablets: <strong>joystick digital</strong> de 8 direções, botão{" "}
                <strong>TIRO</strong> e <strong>GATILHO</strong> (pulso EMP). Segure qualquer controle
                e arraste para reposicioná-lo — a posição fica salva automaticamente.
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
