"use client";

import { Fuel, TriangleAlert } from "lucide-react";
import type { HudState } from "@/lib/game/types";
import { cn } from "@/lib/utils";

/* =========================================================================
 * Medidor de combustível — visual moderno, com gradiente, marcações e
 * ALERTA CRÍTICO quando restam ≤ 10 segundos de combustível.
 * ========================================================================= */

const CRITICAL_SECONDS = 10;

export function FuelGauge({ hud }: { hud: HudState }) {
  const pct = Math.max(0, Math.min(100, hud.fuel));
  const secs = Math.max(0, hud.fuelSeconds);
  const critical = hud.fuelCritical;
  const low = secs <= 20 && !critical;

  // cor do preenchimento por nível
  const fillColor = critical
    ? "linear-gradient(to top, #dc2626, #ef4444, #f87171)"
    : pct > 50
      ? "linear-gradient(to top, #15803d, #22c55e, #4ade80)"
      : pct > 25
        ? "linear-gradient(to top, #a16207, #eab308, #facc15)"
        : "linear-gradient(to top, #b45309, #f97316, #fb923c)";

  return (
    <div
      className={cn(
        "pointer-events-none select-none rounded-2xl border-2 bg-card/70 backdrop-blur-md p-2.5 flex flex-col items-center gap-1.5 transition-colors",
        critical
          ? "fuel-critical border-red-500"
          : low
            ? "border-amber-500/70"
            : "border-border/70"
      )}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={`Combustível: ${Math.round(pct)} por cento, ${Math.ceil(secs)} segundos restantes`}
    >
      {/* Cabeçalho */}
      <div
        className={cn(
          "flex items-center gap-1 text-[10px] font-black tracking-widest",
          critical ? "text-red-400" : "text-muted-foreground"
        )}
      >
        {critical ? (
          <TriangleAlert className="size-3.5 animate-pulse" aria-hidden />
        ) : (
          <Fuel className="size-3.5" aria-hidden />
        )}
        <span>COMB</span>
      </div>

      {/* Barra vertical */}
      <div className="relative h-44 w-9 rounded-full overflow-hidden bg-secondary/70 border border-border/60 shadow-inner">
        {/* marcações a cada 10% */}
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((m) => (
          <div
            key={m}
            className="absolute left-0 right-0 h-px bg-white/15"
            style={{ bottom: `${m}%` }}
            aria-hidden
          />
        ))}
        {/* zona crítica (10s) */}
        <div
          className="absolute left-0 right-0 bottom-0 bg-red-500/25 border-t border-dashed border-red-400/60"
          style={{ height: `${Math.min(100, (CRITICAL_SECONDS / 60) * 100)}%` }}
          aria-hidden
        />
        {/* preenchimento */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 transition-[height] duration-150",
            critical && "animate-pulse"
          )}
          style={{ height: `${pct}%`, background: fillColor }}
        >
          {/* brilho especular */}
          <div className="absolute left-1 top-2 bottom-2 w-1.5 rounded-full bg-white/35 blur-[1px]" />
        </div>
        {/* letra F/E */}
        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-black text-white/85">
          F
        </span>
        <span
          className={cn(
            "absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-black",
            critical ? "text-red-300" : "text-white/85"
          )}
        >
          E
        </span>
      </div>

      {/* Percentual */}
      <span
        className={cn(
          "text-sm font-black tabular-nums leading-none",
          critical ? "text-red-400" : low ? "text-amber-400" : "text-foreground"
        )}
      >
        {Math.round(pct)}%
      </span>

      {/* Segundos restantes */}
      <span
        className={cn(
          "text-[10px] font-bold tabular-nums leading-none px-1.5 py-0.5 rounded-md",
          critical
            ? "bg-red-500/25 text-red-300 banner-flash"
            : "bg-secondary/70 text-muted-foreground"
        )}
      >
        {critical ? `⚠ ${secs.toFixed(0)}s` : `${secs.toFixed(0)}s restantes`}
      </span>
    </div>
  );
}
