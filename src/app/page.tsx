'use client';

/**
 * River Raid Remaster — página principal.
 * Área de jogo centralizada com calhas laterais informativas (desktop)
 * e rodapé fixo na base com atalhos e créditos.
 */

import { Github, Gamepad2, Keyboard, Smartphone } from 'lucide-react';
import { GameShell } from '@/components/game/GameShell';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#020d12] text-slate-100">
      <main className="relative mx-auto flex w-full max-w-6xl flex-1 min-h-0">
        {/* Calha lateral esquerda (desktop) */}
        <aside
          className="relative hidden w-24 shrink-0 flex-col items-center justify-center gap-6 border-r border-white/5 bg-[#021016] lg:flex"
          aria-hidden
        >
          <span
            className="font-mono text-[10px] font-bold uppercase tracking-[0.35em] text-teal-500/50"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            River Raid Remaster
          </span>
          <div className="h-16 w-px bg-gradient-to-b from-transparent via-teal-400/40 to-transparent" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-600">
            v1.0
          </span>
        </aside>

        {/* Área do jogo */}
        <div className="relative min-h-[560px] flex-1 md:min-h-[600px]">
          <GameShell />
        </div>

        {/* Calha lateral direita (desktop) */}
        <aside
          className="relative hidden w-24 shrink-0 flex-col items-center justify-center gap-5 border-l border-white/5 bg-[#021016] lg:flex"
          aria-hidden
        >
          <div className="flex flex-col items-center gap-2 text-slate-600">
            <Keyboard className="size-5" />
            <span className="font-mono text-[9px] uppercase tracking-widest [writing-mode:vertical-rl]">
              WASD · espaço
            </span>
          </div>
          <div className="flex flex-col items-center gap-2 text-slate-600">
            <Gamepad2 className="size-5" />
            <span className="font-mono text-[9px] uppercase tracking-widest [writing-mode:vertical-rl]">
              analógico · A · start
            </span>
          </div>
          <div className="flex flex-col items-center gap-2 text-slate-600">
            <Smartphone className="size-5" />
            <span className="font-mono text-[9px] uppercase tracking-widest [writing-mode:vertical-rl]">
              toque suportado
            </span>
          </div>
        </aside>
      </main>

      {/* Rodapé fixo na base */}
      <footer className="mt-auto border-t border-white/10 bg-[#020a0e] px-4 py-2.5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-400 sm:justify-between">
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span>
              <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">WASD/setas</kbd>{' '}
              mover
            </span>
            <span>
              <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">espaço</kbd>{' '}
              atirar
            </span>
            <span>
              <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">P</kbd>{' '}
              pausar
            </span>
            <span>
              <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">M</kbd>{' '}
              som
            </span>
            <span className="hidden sm:inline">🎮 gamepad · 📱 toque</span>
          </p>
          <p className="flex items-center gap-3">
            <span className="hidden md:inline">
              Homenagem remasterizada ao clássico <em>River Raid</em> (Activision, 1982)
            </span>
            <a
              href="https://github.com/AtamisFilho/projetoriverraidcopilot"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-teal-300 transition-colors hover:text-teal-200"
            >
              <Github className="size-3.5" />
              GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
