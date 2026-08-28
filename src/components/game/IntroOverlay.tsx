'use client';

/**
 * Telas estáticas de história (capítulos) e alertas de chefe —
 * exatamente o formato pedido no PDF, agora com tipografia e visual
 * coerentes com o jogo.
 */

import { AlertTriangle, BookOpen, Skull } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function IntroOverlay({
  title,
  lines,
  quote,
  kind,
  onConfirm,
}: {
  title: string;
  lines: string[];
  quote?: string;
  kind: 'chapter' | 'boss';
  onConfirm: () => void;
}) {
  const isBoss = kind === 'boss';
  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl sm:p-8 ${
          isBoss
            ? 'border-red-500/40 bg-gradient-to-b from-[#2a0a0a]/95 to-[#12060a]/95'
            : 'border-teal-400/25 bg-gradient-to-b from-[#04202a]/95 to-[#031218]/95'
        }`}
      >
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em]">
          {isBoss ? (
            <span className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="size-4 animate-pulse" />
              Alerta de chefe
            </span>
          ) : (
            <span className="flex items-center gap-2 text-teal-300">
              <BookOpen className="size-4" />
              Campanha
            </span>
          )}
        </div>

        <h2
          className={`font-mono text-xl font-black leading-tight sm:text-2xl ${
            isBoss ? 'text-red-300' : 'text-teal-200'
          }`}
        >
          {title}
        </h2>

        <div className="mt-4 space-y-2 text-sm leading-relaxed text-slate-200">
          {lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>

        {quote && (
          <blockquote
            className={`mt-4 border-l-2 pl-3 text-sm italic ${
              isBoss ? 'border-red-500/50 text-red-200/80' : 'border-teal-400/50 text-teal-100/80'
            }`}
          >
            {quote}
          </blockquote>
        )}

        {isBoss && (
          <p className="mt-4 flex items-center gap-2 text-xs text-red-300/90">
            <Skull className="size-4" />
            O chefe aparece ao continuar. Use o escudo com sabedoria.
          </p>
        )}

        <Button
          size="lg"
          className="mt-6 w-full"
          variant={isBoss ? 'destructive' : 'default'}
          onClick={onConfirm}
          autoFocus
        >
          Continuar (Espaço)
        </Button>
      </div>
    </div>
  );
}
