"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crosshair,
  Zap,
} from "lucide-react";
import type { RiverRaidGame, TouchInput } from "@/lib/game/engine";
import { cn } from "@/lib/utils";

/* =========================================================================
 * Controles virtuais para celulares e tablets:
 *  - Joystick DIGITAL de 8 direções (esquerda/direita/acelerar/frear)
 *  - Botão TIRO (disparo contínuo)
 *  - Botão GATILHO (pulso EMP — cargas limitadas)
 *
 * Qualquer um dos três controles pode ser REPOSICIONADO pelo usuário com um
 * simples arrastar-e-soltar: segure o controle por ~0,45 s sem mover e
 * arraste-o para a posição desejada. As posições (normalizadas 0..1 em
 * relação à área do jogo) são persistidas em localStorage.
 * Dica de teste em desktop: abra o jogo com ?touch=1 para forçar os controles.
 * ========================================================================= */

type ControlId = "joy" | "fire" | "trigger";

interface ControlPos {
  x: number; // 0..1 relativo à largura da área do jogo
  y: number; // 0..1 relativo à altura da área do jogo
}

type Positions = Record<ControlId, ControlPos>;

const STORAGE_KEY = "rr-controls-v1";
const HINT_KEY = "rr-controls-hint-v1";
const LONG_PRESS_MS = 450;
const DRAG_SLOP_PX = 12; // deslocamento que caracteriza gesto (cancela o longo-toque)

const DEFAULTS: Positions = {
  joy: { x: 0.24, y: 0.79 },
  fire: { x: 0.83, y: 0.82 },
  trigger: { x: 0.615, y: 0.675 },
};

/** Diâmetro em px de cada controle (para o clamp dentro da área) */
const SIZES: Record<ControlId, number> = { joy: 128, fire: 84, trigger: 68 };

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** setPointerCapture protegido: falha silenciosa para ponteiros já encerrados */
function safeCapture(el: HTMLElement, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* ponteiro sintético ou já finalizado */
  }
}

function loadPositions(): Positions {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Positions>;
    const out = { ...DEFAULTS };
    for (const id of ["joy", "fire", "trigger"] as ControlId[]) {
      const v = parsed[id];
      if (v && Number.isFinite(v.x) && Number.isFinite(v.y)) {
        out[id] = { x: clamp(v.x, 0, 1), y: clamp(v.y, 0, 1) };
      }
    }
    return out;
  } catch {
    return { ...DEFAULTS };
  }
}

function savePositions(p: Positions) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* sem localStorage: posições valem só para a partida */
  }
}

export function VirtualControls({
  gameRef,
  emp,
  paused,
}: {
  gameRef: React.RefObject<RiverRaidGame | null>;
  emp: number;
  paused?: boolean;
}) {
  const [isTouch, setIsTouch] = useState(false);
  const [pos, setPos] = useState<Positions>(() => ({ ...DEFAULTS }));
  const [showHint, setShowHint] = useState(false);
  const [dragging, setDragging] = useState<ControlId | null>(null);
  // direções ativas do joystick (estado digital)
  const [dir, setDir] = useState({ left: false, right: false, up: false, down: false });
  const [knob, setKnob] = useState({ kx: 0, ky: 0 });
  const [fireHeld, setFireHeld] = useState(false);
  const [triggerHeld, setTriggerHeld] = useState(false);

  const areaRef = useRef<HTMLDivElement>(null);
  const joyRef = useRef<HTMLDivElement>(null);

  // arrasto em andamento (id + ponteiro + deslocamento do ponto de pegada)
  const dragRef = useRef<{ id: ControlId; pointerId: number; offX: number; offY: number } | null>(null);
  // temporizadores de longo-toque por controle
  const lpRef = useRef<Partial<Record<ControlId, number>>>({});
  // ponto inicial do ponteiro (para cancelar longo-toque quando mover)
  const startRef = useRef<{ x: number; y: number } | null>(null);
  // referência viva de `pos` para listeners/ponteiros fora do ciclo de render
  const posRef = useRef(pos);
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  /* ------------------------------ engine ------------------------------ */

  const press = useCallback(
    (key: keyof TouchInput, on: boolean) => {
      gameRef.current?.setTouch({ [key]: on } as Partial<TouchInput>);
    },
    [gameRef]
  );

  const releaseAll = useCallback(() => {
    setDir({ left: false, right: false, up: false, down: false });
    setKnob({ kx: 0, ky: 0 });
    setFireHeld(false);
    setTriggerHeld(false);
    const game = gameRef.current;
    if (!game) return;
    game.setTouch({ left: false, right: false, accel: false, decel: false, fire: false, special: false });
  }, [gameRef]);

  /* ---------------------- arrastar-e-soltar ---------------------- */

  const cancelLongPress = useCallback(() => {
    for (const t of Object.values(lpRef.current)) {
      if (t) window.clearTimeout(t);
    }
    lpRef.current = {};
  }, []);

  const beginDrag = useCallback(
    (id: ControlId, e: React.PointerEvent) => {
      const area = areaRef.current?.getBoundingClientRect();
      if (!area) return;
      // solta os comandos do controle antes de arrastar
      if (id === "joy") {
        setDir({ left: false, right: false, up: false, down: false });
        setKnob({ kx: 0, ky: 0 });
        gameRef.current?.setTouch({ left: false, right: false, accel: false, decel: false });
      } else if (id === "fire") {
        setFireHeld(false);
        gameRef.current?.setTouch({ fire: false });
      } else {
        setTriggerHeld(false);
        gameRef.current?.setTouch({ special: false });
      }
      const p = posRef.current[id];
      dragRef.current = {
        id,
        pointerId: e.pointerId,
        offX: p.x * area.width - (e.clientX - area.left),
        offY: p.y * area.height - (e.clientY - area.top),
      };
      setDragging(id);
      navigator.vibrate?.(14);
    },
    [gameRef]
  );

  const startLongPress = useCallback(
    (id: ControlId, e: React.PointerEvent) => {
      cancelLongPress();
      startRef.current = { x: e.clientX, y: e.clientY };
      lpRef.current[id] = window.setTimeout(() => {
        startRef.current = null;
        beginDrag(id, e);
      }, LONG_PRESS_MS);
    },
    [beginDrag, cancelLongPress]
  );

  /** Movimento do ponteiro enquanto um arrasto está ativo */
  const onDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const area = areaRef.current?.getBoundingClientRect();
    if (!area) return;
    const half = SIZES[d.id] / 2 + 6;
    const px = clamp(e.clientX - area.left + d.offX, half, Math.max(half, area.width - half));
    const py = clamp(e.clientY - area.top + d.offY, half, Math.max(half, area.height - half));
    setPos((prev) => ({
      ...prev,
      [d.id]: { x: px / area.width, y: py / area.height },
    }));
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return false;
    dragRef.current = null;
    setDragging(null);
    savePositions(posRef.current);
    navigator.vibrate?.(10);
    return true;
  };

  /** Cancela o longo-toque quando o dedo desloca além do limiar */
  const maybeCancelLongPress = (e: React.PointerEvent) => {
    const s = startRef.current;
    if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > DRAG_SLOP_PX) {
      cancelLongPress();
      startRef.current = null;
    }
  };

  /* --------------------- detecção de tela de toque --------------------- */

  useEffect(() => {
    // setState assíncrono para evitar render em cascata durante o efeito
    const id = window.setTimeout(() => {
      const coarse =
        window.matchMedia?.("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
      const forced = new URLSearchParams(window.location.search).has("touch");
      const touch = !!coarse || forced;
      setIsTouch(touch);
      if (touch) {
        setPos(loadPositions());
        try {
          if (!window.localStorage.getItem(HINT_KEY)) {
            setShowHint(true);
            window.setTimeout(() => {
              setShowHint(false);
              window.localStorage.setItem(HINT_KEY, "1");
            }, 9000);
          }
        } catch {
          /* localStorage indisponível: apenas ignora a dica persistente */
        }
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  /* ------------------ rede de segurança: solta tudo ------------------ */

  useEffect(() => {
    const clear = () => {
      cancelLongPress();
      if (dragRef.current) {
        dragRef.current = null;
        setDragging(null);
        savePositions(posRef.current);
      }
      releaseAll();
    };
    window.addEventListener("pointerup", clear);
    window.addEventListener("pointercancel", clear);
    return () => {
      window.removeEventListener("pointerup", clear);
      window.removeEventListener("pointercancel", clear);
    };
  }, [cancelLongPress, releaseAll]);

  /* ---------------------- evento global de reset ---------------------- */

  useEffect(() => {
    const onReset = () => {
      setPos({ ...DEFAULTS });
      savePositions({ ...DEFAULTS });
      setShowHint(true);
      window.setTimeout(() => setShowHint(false), 4000);
    };
    window.addEventListener("rr-reset-controls", onReset);
    return () => window.removeEventListener("rr-reset-controls", onReset);
  }, []);

  /* ------------------------- joystick digital ------------------------- */

  const steer = (e: React.PointerEvent) => {
    if (dragRef.current?.id === "joy") return;
    maybeCancelLongPress(e);
    const el = joyRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const maxR = r.width * 0.34;
    const dead = 13;

    let left = false,
      right = false,
      up = false,
      down = false,
      kx = 0,
      ky = 0;
    if (Math.hypot(dx, dy) >= dead) {
      const nx = dx / maxR;
      const ny = dy / maxR;
      // quantização digital: 8 direções possíveis
      left = nx < -0.3;
      right = nx > 0.3;
      up = ny < -0.36;
      down = ny > 0.36;
      const qx = (right ? 1 : 0) - (left ? 1 : 0);
      const qy = (down ? 1 : 0) - (up ? 1 : 0);
      if (qx || qy) {
        const inv = qx !== 0 && qy !== 0 ? Math.SQRT1_2 : 1;
        kx = qx * inv * 30;
        ky = qy * inv * 30;
      }
    }
    setDir({ left, right, up, down });
    setKnob({ kx, ky });
    press("left", left);
    press("right", right);
    press("accel", up);
    press("decel", down);
  };

  const releaseSteer = () => {
    setDir({ left: false, right: false, up: false, down: false });
    setKnob({ kx: 0, ky: 0 });
    press("left", false);
    press("right", false);
    press("accel", false);
    press("decel", false);
  };

  if (!isTouch || paused) return null;

  const draggingClass =
    "cursor-grabbing scale-110 opacity-80 border-dashed border-primary z-40 ring-4 ring-primary/30";

  return (
    <div ref={areaRef} className="pointer-events-none absolute inset-0 z-20">
      {/* -------------------- dica de reposicionamento -------------------- */}
      {showHint && !dragging && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center px-4">
          <div className="rounded-full border border-border/70 bg-card/85 backdrop-blur px-3.5 py-1.5 text-[10px] font-bold text-muted-foreground shadow-lg text-center">
            Segure e arraste os controles para reposicionar
          </div>
        </div>
      )}
      {dragging && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-40 flex justify-center px-4">
          <div className="rounded-full border border-primary/60 bg-primary/15 backdrop-blur px-3.5 py-1.5 text-[10px] font-black text-primary shadow-lg">
            Solte para fixar a posição
          </div>
        </div>
      )}

      {/* -------------------- joystick digital -------------------- */}
      <div
        className="pointer-events-auto absolute select-none touch-none"
        style={{
          left: `${pos.joy.x * 100}%`,
          top: `${pos.joy.y * 100}%`,
          transform: "translate(-50%, -50%)",
          width: SIZES.joy,
          height: SIZES.joy,
        }}
      >
        <div
          ref={joyRef}
          role="application"
          aria-label="Joystick digital de 8 direções: arraste para direcionar a aeronave"
          onPointerDown={(e) => {
            e.preventDefault();
            safeCapture(e.currentTarget as HTMLElement, e.pointerId);
            startLongPress("joy", e);
            steer(e);
          }}
          onPointerMove={(e) => {
            if (dragRef.current?.id === "joy") onDragMove(e);
            else steer(e);
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            cancelLongPress();
            if (!endDrag(e)) releaseSteer();
          }}
          onPointerCancel={() => {
            cancelLongPress();
            if (dragRef.current?.id === "joy") {
              dragRef.current = null;
              setDragging(null);
              savePositions(posRef.current);
            }
            releaseSteer();
          }}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "relative size-full rounded-full border-2 border-border/70 bg-card/55 backdrop-blur-md shadow-xl transition-[transform,opacity,border] duration-150",
            dragging === "joy" && draggingClass
          )}
        >
          {/* guias de direção */}
          <ChevronUp
            className={cn(
              "absolute top-1 left-1/2 -translate-x-1/2 size-5 transition-colors",
              dir.up ? "text-primary" : "text-muted-foreground/40"
            )}
            aria-hidden
          />
          <ChevronDown
            className={cn(
              "absolute bottom-1 left-1/2 -translate-x-1/2 size-5 transition-colors",
              dir.down ? "text-primary" : "text-muted-foreground/40"
            )}
            aria-hidden
          />
          <ChevronLeft
            className={cn(
              "absolute left-1 top-1/2 -translate-y-1/2 size-5 transition-colors",
              dir.left ? "text-primary" : "text-muted-foreground/40"
            )}
            aria-hidden
          />
          <ChevronRight
            className={cn(
              "absolute right-1 top-1/2 -translate-y-1/2 size-5 transition-colors",
              dir.right ? "text-primary" : "text-muted-foreground/40"
            )}
            aria-hidden
          />
          {/* centro neutro */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-1.5 rounded-full bg-muted-foreground/30" aria-hidden />
          </div>
          {/* knob */}
          <div
            className={cn(
              "absolute left-1/2 top-1/2 size-14 rounded-full border-2 border-primary/70 bg-primary/25 backdrop-blur-sm shadow-lg transition-transform duration-75",
              (dir.left || dir.right || dir.up || dir.down) && "bg-primary/45"
            )}
            style={{ transform: `translate(calc(-50% + ${knob.kx}px), calc(-50% + ${knob.ky}px))` }}
            aria-hidden
          />
        </div>
      </div>

      {/* -------------------- botão GATILHO (pulso EMP) -------------------- */}
      <div
        className="pointer-events-auto absolute select-none touch-none"
        style={{
          left: `${pos.trigger.x * 100}%`,
          top: `${pos.trigger.y * 100}%`,
          transform: "translate(-50%, -50%)",
          width: SIZES.trigger,
          height: SIZES.trigger,
        }}
      >
        <button
          type="button"
          aria-label={`Gatilho: pulso EMP (${emp} carga${emp === 1 ? "" : "s"} restante${emp === 1 ? "" : "s"})`}
          aria-pressed={triggerHeld}
          onPointerDown={(e) => {
            e.preventDefault();
            safeCapture(e.currentTarget as HTMLElement, e.pointerId);
            startLongPress("trigger", e);
            if (!dragRef.current) {
              setTriggerHeld(true);
              press("special", true);
            }
          }}
          onPointerMove={(e) => {
            if (dragRef.current?.id === "trigger") onDragMove(e);
            else maybeCancelLongPress(e);
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            cancelLongPress();
            const wasDrag = endDrag(e);
            setTriggerHeld(false);
            if (!wasDrag) press("special", false);
          }}
          onPointerCancel={() => {
            cancelLongPress();
            if (dragRef.current?.id === "trigger") {
              dragRef.current = null;
              setDragging(null);
              savePositions(posRef.current);
            }
            setTriggerHeld(false);
            press("special", false);
          }}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "relative size-full rounded-full border-2 border-sky-400/70 bg-sky-950/60 backdrop-blur-md text-sky-300 shadow-xl flex flex-col items-center justify-center gap-0.5 transition-[transform,opacity,border] duration-150 active:scale-95",
            triggerHeld && "bg-sky-500/50 border-sky-300",
            dragging === "trigger" && draggingClass,
            emp <= 0 && "opacity-45 grayscale"
          )}
        >
          <Zap className="size-7" strokeWidth={2.4} aria-hidden />
          <span className="text-[9px] font-black tracking-widest">GATILHO</span>
          <span
            className={cn(
              "absolute -top-1.5 -right-1.5 min-w-5 rounded-full px-1 text-[10px] font-black leading-4 text-center tabular-nums shadow",
              emp > 0 ? "bg-sky-400 text-slate-950" : "bg-secondary text-muted-foreground"
            )}
            aria-hidden
          >
            {emp}
          </span>
        </button>
      </div>

      {/* -------------------- botão TIRO -------------------- */}
      <div
        className="pointer-events-auto absolute select-none touch-none"
        style={{
          left: `${pos.fire.x * 100}%`,
          top: `${pos.fire.y * 100}%`,
          transform: "translate(-50%, -50%)",
          width: SIZES.fire,
          height: SIZES.fire,
        }}
      >
        <button
          type="button"
          aria-label="Atirar (segure para disparo contínuo)"
          aria-pressed={fireHeld}
          onPointerDown={(e) => {
            e.preventDefault();
            safeCapture(e.currentTarget as HTMLElement, e.pointerId);
            startLongPress("fire", e);
            if (!dragRef.current) {
              setFireHeld(true);
              press("fire", true);
            }
          }}
          onPointerMove={(e) => {
            if (dragRef.current?.id === "fire") onDragMove(e);
            else maybeCancelLongPress(e);
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            cancelLongPress();
            const wasDrag = endDrag(e);
            setFireHeld(false);
            if (!wasDrag) press("fire", false);
          }}
          onPointerCancel={() => {
            cancelLongPress();
            if (dragRef.current?.id === "fire") {
              dragRef.current = null;
              setDragging(null);
              savePositions(posRef.current);
            }
            setFireHeld(false);
            press("fire", false);
          }}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "relative size-full rounded-full border-2 border-red-500/70 bg-red-950/60 backdrop-blur-md text-red-300 shadow-xl flex flex-col items-center justify-center gap-0.5 transition-[transform,opacity,border] duration-150 active:scale-95",
            fireHeld && "bg-red-600/60 border-red-300",
            dragging === "fire" && draggingClass
          )}
        >
          <Crosshair className="size-9" strokeWidth={2.4} aria-hidden />
          <span className="text-[10px] font-black tracking-widest">TIRO</span>
        </button>
      </div>
    </div>
  );
}
