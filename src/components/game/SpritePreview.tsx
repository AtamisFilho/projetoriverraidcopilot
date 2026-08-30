"use client";

import { useEffect, useRef } from "react";
import { drawEntityById, SPRITE_HALF } from "@/lib/game/sprites";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  size?: number;
  className?: string;
  zoom?: number;
}

/** Mini-canvas animado que renderiza o sprite REAL do jogo nos cards do briefing */
export function SpritePreview({ id, size = 108, className, zoom = 1 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let t = Math.random() * 10;
    let last = performance.now();

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const [halfW, halfH] = SPRITE_HALF[id] ?? [24, 24];
    const fit = ((size * 0.42) / Math.max(halfW, halfH)) * zoom;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      // fundo sutil (água)
      const g = ctx.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, "rgba(14,116,144,0.35)");
      g.addColorStop(1, "rgba(11,79,108,0.55)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(0, 0, size, size, 12);
      ctx.fill();
      // ondinha de fundo
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 2;
      for (let y = 14; y < size; y += 22) {
        ctx.beginPath();
        for (let x = 4; x < size - 4; x += 12) {
          const yy = y + Math.sin(x * 0.08 + t * 1.5 + y) * 2.4;
          if (x === 4) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.scale(fit, fit);
      drawEntityById(ctx, id, t);
      ctx.restore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [id, size, zoom]);

  return (
    <canvas
      ref={ref}
      style={{ width: size, height: size }}
      className={cn("rounded-xl border border-border/60 shadow-inner shrink-0", className)}
      aria-label={`Prévia do elemento: ${id}`}
      role="img"
    />
  );
}
