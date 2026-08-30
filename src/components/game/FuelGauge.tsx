"use client";

import { Fuel, TriangleAlert } from "lucide-react";
import type { HudState } from "@/lib/game/types";
import { cn } from "@/lib/utils";

/* =========================================================================
 * Medidor de combustível — versão COMPACTA.
 * Vive no canto superior direito, logo abaixo do botão de pausa, na mesma
 * escala dos botões do HUD, sem atrapalhar a visão do rio.
 * Mantém o ALERTA CRÍTICO quando restam ≤ 10 segundos de combustível.
 * ========================================================================= */

const CRITICAL_SECONDS = 10;

export function FuelGauge({ hud }: { hud: HudState }) {
  const pct = Math.max(0, Math.min(100, hud.fuel));
  const secs = Math.max(0, hud.fuelSeconds);
  const critical = hud.fuelCritical;
  const low = secs <= 20 && !critical;

  // cor do preenchimento por nível
  const fillColor = critical
    ? "linear-gradient(to top, #dc2626, #ef4444)"
    : pct > 50
      ? "linear-gradient(to top, #15803d, #22c55e)"
      : pct > 25
        ? "linear-gradient(to top, #a16207, #eab308)"
        : "linear-gradient(to top, #b45309, #f97316)";

  return (
    <div
      className={cn(
        "pointer-events-none select-none rounded-lg border bg-card/70 backdrop-blur-md px-1.5 py-1 flex items-center gap-1.5",
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
      {/* Barra vertical fina */}
      <div
        className="relative h-11 w-2 rounded-full overflow-hidden bg-secondary/80 border border-border/50"
        aria-hidden
      >
        {/* zona crítica (10s ≈ 1/6 do tanque) */}
        <div
          className="absolute inset-x-0 bottom-0 bg-red-500/25 border-t border-dashed border-red-400/60"
          style={{ height: `${Math.min(100, (CRITICAL_SECONDS / 60) * 100)}%` }}
        />
        {/* preenchimento */}
        <div
          className={cn(
            "absolute bottom-0 inset-x-0 transition-[height] duration-150",
            critical && "animate-pulse"
          )}
          style={{ height: `${pct}%`, background: fillColor }}
        />
      </div>

      {/* Leituras */}
      <div className="flex flex-col items-end justify-center gap-0.5">
        <span
          className={cn(
            "text-[11px] font-black tabular-nums leading-none",
            critical ? "text-red-400" : low ? "text-amber-400" : "text-foreground"
          )}
        >
          {Math.round(pct)}%
        </span>
        {critical ? (
          <span className="banner-flash flex items-center gap-0.5 text-[9px] font-black text-red-300 leading-none">
            <TriangleAlert className="size-2.5" aria-hidden />
            {secs.toFixed(0)}s
          </span>
        ) : low ? (
          <span className="text-[9px] font-bold tabular-nums text-amber-400 leading-none">
            {secs.toFixed(0)}s
          </span>
        ) : (
          <span className="flex items-center gap-0.5 text-[8px] font-black tracking-widest text-muted-foreground leading-none">
            <Fuel className="size-2.5" aria-hidden />
            COMB
          </span>
        )}
      </div>
    </div>
  );
}
