"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Crosshair } from "lucide-react";
import type { RiverRaidGame } from "@/lib/game/engine";
import { cn } from "@/lib/utils";

/* Controles de toque para dispositivos móveis (pointer coarse) */

export function TouchControls({
  gameRef,
}: {
  gameRef: React.RefObject<RiverRaidGame | null>;
}) {
  const [isTouch, setIsTouch] = useState(false);
  const holdRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const coarse =
      (typeof window !== "undefined" &&
        window.matchMedia?.("(pointer: coarse)").matches) ||
      (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);
    // setState assíncrono para evitar render em cascata
    const id = window.setTimeout(() => setIsTouch(!!coarse), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const clearAll = () => {
      if (holdRef.current._any) {
        holdRef.current = {};
        gameRef.current?.setTouch({
          left: false,
          right: false,
          fire: false,
          accel: false,
          decel: false,
        });
      }
    };
    window.addEventListener("pointerup", clearAll);
    window.addEventListener("pointercancel", clearAll);
    return () => {
      window.removeEventListener("pointerup", clearAll);
      window.removeEventListener("pointercancel", clearAll);
    };
  }, [gameRef]);

  const press = useCallback(
    (key: "left" | "right" | "fire" | "accel" | "decel", on: boolean) => {
      holdRef.current[key] = on;
      if (on) holdRef.current._any = true;
      gameRef.current?.setTouch({ [key]: on });
    },
    [gameRef]
  );

  if (!isTouch) return null;

  const bind = (key: "left" | "right" | "fire" | "accel" | "decel") => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      press(key, true);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      press(key, false);
    },
    onPointerLeave: () => {
      press(key, false);
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const base =
    "select-none touch-none flex items-center justify-center rounded-2xl border-2 border-border/70 bg-card/75 backdrop-blur-md text-foreground/90 active:bg-primary/40 active:scale-95 active:border-primary transition-transform shadow-lg";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-3 pb-5">
      {/* direção */}
      <div className="pointer-events-auto flex gap-2.5">
        <button {...bind("left")} className={cn(base, "size-16")} aria-label="Mover para a esquerda">
          <ChevronLeft className="size-8" strokeWidth={3} />
        </button>
        <button {...bind("right")} className={cn(base, "size-16")} aria-label="Mover para a direita">
          <ChevronRight className="size-8" strokeWidth={3} />
        </button>
      </div>
      {/* acelerar / frear */}
      <div className="pointer-events-auto flex flex-col gap-2">
        <button {...bind("accel")} className={cn(base, "h-11 w-16")} aria-label="Acelerar">
          <ChevronUp className="size-6" strokeWidth={3} />
        </button>
        <button {...bind("decel")} className={cn(base, "h-11 w-16")} aria-label="Desacelerar">
          <ChevronDown className="size-6" strokeWidth={3} />
        </button>
      </div>
      {/* disparar */}
      <div className="pointer-events-auto">
        <button
          {...bind("fire")}
          className={cn(base, "size-20 rounded-full border-red-500/70 bg-red-950/60 text-red-300 active:bg-red-600/60")}
          aria-label="Atirar"
        >
          <Crosshair className="size-9" strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}
