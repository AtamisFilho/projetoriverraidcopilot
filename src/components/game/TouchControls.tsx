'use client';

/**
 * Controles de toque para dispositivos móveis: joystick virtual à
 * esquerda e botão de fogo à direita (a especificação pedia otimização
 * mobile — o código original do PDF não tinha entrada de toque).
 */

import { useRef, useState } from 'react';
import { Flame, Pause } from 'lucide-react';
import type { InputManager } from '@/game/input/input';

export function TouchControls({
  input,
  onPause,
}: {
  input: InputManager;
  onPause: () => void;
}) {
  const stickRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [firing, setFiring] = useState(false);
  const stickId = useRef<number | null>(null);

  const updateStick = (touch: Touch) => {
    const el = stickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = rect.width / 2;
    let dx = (touch.clientX - cx) / radius;
    let dy = (touch.clientY - cy) / radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    setKnob({ x: dx, y: dy });
    input.setTouchAxis(dx, dy);
  };

  const endStick = () => {
    stickId.current = null;
    setKnob({ x: 0, y: 0 });
    input.setTouchAxis(0, 0);
  };

  return (
    <div className="absolute inset-0 z-10 select-none" style={{ touchAction: 'none' }}>
      {/* Botão de pausa */}
      <button
        type="button"
        aria-label="Pausar"
        onClick={onPause}
        className="absolute right-3 top-24 grid size-11 place-items-center rounded-full border border-white/15 bg-black/50 text-slate-200 backdrop-blur-sm active:bg-black/70 sm:top-28"
      >
        <Pause className="size-5" />
      </button>

      {/* Joystick virtual */}
      <div
        ref={stickRef}
        role="application"
        aria-label="Controle de direção"
        className="absolute bottom-8 left-5 size-32 rounded-full border border-white/20 bg-black/35 backdrop-blur-sm sm:size-36"
        onTouchStart={(e) => {
          e.preventDefault();
          const t = e.changedTouches[0];
          stickId.current = t.identifier;
          updateStick(t);
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          for (const t of Array.from(e.changedTouches)) {
            if (t.identifier === stickId.current) updateStick(t);
          }
        }}
        onTouchEnd={(e) => {
          for (const t of Array.from(e.changedTouches)) {
            if (t.identifier === stickId.current) endStick();
          }
        }}
        onTouchCancel={endStick}
      >
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-teal-300/50 bg-teal-400/25 shadow-lg transition-transform"
          style={{ transform: `translate(calc(-50% + ${knob.x * 34}px), calc(-50% + ${knob.y * 34}px))` }}
        />
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-[9px] uppercase tracking-widest text-white/30">
          mover
        </span>
      </div>

      {/* Botão de fogo */}
      <button
        type="button"
        aria-label="Atirar"
        className={`absolute bottom-10 right-6 grid size-24 place-items-center rounded-full border-2 backdrop-blur-sm active:scale-95 ${
          firing
            ? 'border-amber-300 bg-amber-500/40 shadow-[0_0_24px_rgba(251,191,36,0.5)]'
            : 'border-red-400/50 bg-red-500/25'
        }`}
        onTouchStart={(e) => {
          e.preventDefault();
          setFiring(true);
          input.setTouchFire(true);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          setFiring(false);
          input.setTouchFire(false);
        }}
        onTouchCancel={() => {
          setFiring(false);
          input.setTouchFire(false);
        }}
      >
        <Flame className="size-8 text-amber-200" />
        <span className="absolute bottom-4 text-[10px] font-bold uppercase tracking-widest text-white/70">
          fogo
        </span>
      </button>
    </div>
  );
}
