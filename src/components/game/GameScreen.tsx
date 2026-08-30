"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Gauge,
  Heart,
  MapPin,
  Pause,
  Play,
  Shield,
  Signpost,
  TriangleAlert,
  Volume2,
  VolumeX,
  Zap,
  Crosshair,
  Rocket,
} from "lucide-react";
import { RiverRaidGame } from "@/lib/game/engine";
import type { HudState, RunResult } from "@/lib/game/types";
import { FuelGauge } from "./FuelGauge";
import { TouchControls } from "./TouchControls";
import { cn } from "@/lib/utils";

const initialHud: HudState = {
  score: 0,
  combo: 0,
  fuel: 100,
  fuelSeconds: 60,
  fuelCritical: false,
  speedKmh: 140,
  lives: 3,
  chapter: 1,
  chapterName: "Nascente do Rio",
  distanceM: 0,
  weapons: { shield: 0, triple: 0, homing: 0, turbo: 0 },
  bossActive: false,
  bossName: "",
  bossHpPct: 0,
  paused: false,
};

interface Props {
  onFinished: (r: RunResult) => void;
  onExit: () => void;
}

export function GameScreen({ onFinished, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<RiverRaidGame | null>(null);
  const [hud, setHud] = useState<HudState>(initialHud);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new RiverRaidGame(canvas, {
      onHud: (h) => setHud(h),
      onGameOver: (r) => onFinished(r),
      onChapterStart: () => {},
    });
    gameRef.current = game;
    setReady(true);
    // pequeno atraso para o layout assentar antes do primeiro resize
    const t = window.setTimeout(() => game.resize(), 60);
    return () => {
      window.clearTimeout(t);
      game.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startGame = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.audio.init();
    g.audio.resume();
    g.start();
    setStarted(true);
  }, []);

  const togglePause = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    if (g.paused) g.resume();
    else g.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const next = !g.audio.muted;
    g.setMuted(next);
    setMuted(next);
  }, []);

  const critical = hud.fuelCritical && started;

  return (
    <div className="w-full min-h-dvh flex flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Área do jogo — proporção 9:16, altura cheia */}
      <div
        className="relative bg-black"
        style={{ height: "100dvh", aspectRatio: "9 / 16", maxWidth: "100vw" }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          aria-label="Área do jogo River Raid Remaster"
        />

        {/* ---------------- HUD superior ---------------- */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-2.5 flex items-start justify-between gap-2">
          {/* Pontuação */}
          <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-md px-3 py-1.5 shadow-lg">
            <div className="text-[9px] font-black tracking-widest text-muted-foreground">PONTOS</div>
            <div className="text-xl font-black tabular-nums leading-6 text-primary">
              {hud.score.toLocaleString("pt-BR")}
            </div>
            {hud.combo >= 4 && (
              <div className="text-[10px] font-black text-amber-400">
                COMBO ×{Math.min(4, 1 + Math.floor(hud.combo / 4))}
              </div>
            )}
          </div>

          {/* Capítulo / distância / vidas */}
          <div className="flex flex-col items-center gap-1">
            <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-md px-3 py-1 shadow-lg text-center">
              <div className="text-[9px] font-black tracking-widest text-muted-foreground">
                CAPÍTULO {hud.chapter}
              </div>
              <div className="text-[11px] font-bold text-foreground/90 leading-tight max-w-36 truncate">
                {hud.chapterName}
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-cyan-300 tabular-nums justify-center">
                <MapPin className="size-3" aria-hidden />
                {hud.distanceM.toLocaleString("pt-BR")} m
              </div>
            </div>
            <div className="flex gap-0.5" aria-label={`${hud.lives} vidas restantes`}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Heart
                  key={i}
                  className={cn(
                    "size-4 drop-shadow",
                    i < hud.lives ? "fill-red-500 text-red-500" : "text-muted-foreground/40"
                  )}
                  aria-hidden
                />
              ))}
            </div>
          </div>

          {/* Velocidade + botões */}
          <div className="flex flex-col items-end gap-1.5">
            <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-md px-3 py-1.5 shadow-lg text-right">
              <div className="flex items-center gap-1 text-[9px] font-black tracking-widest text-muted-foreground justify-end">
                <Gauge className="size-3" aria-hidden />
                VEL
              </div>
              <div className="text-lg font-black tabular-nums leading-5">{hud.speedKmh}</div>
              <div className="text-[8px] font-bold text-muted-foreground">km/h</div>
            </div>
            <div className="pointer-events-auto flex gap-1.5">
              <button
                onClick={toggleMute}
                className="size-8 rounded-lg border border-border/60 bg-card/70 backdrop-blur-md flex items-center justify-center hover:bg-secondary/70 cursor-pointer"
                aria-label={muted ? "Ativar som" : "Silenciar"}
              >
                {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>
              <button
                onClick={togglePause}
                className="size-8 rounded-lg border border-border/60 bg-card/70 backdrop-blur-md flex items-center justify-center hover:bg-secondary/70 cursor-pointer"
                aria-label={hud.paused ? "Continuar" : "Pausar"}
              >
                {hud.paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* ---------------- Banner de alerta crítico de combustível ---------------- */}
        {critical && (
          <div className="pointer-events-none absolute inset-x-0 top-24 z-20 flex justify-center">
            <div className="banner-flash rounded-xl border-2 border-red-500 bg-red-950/85 backdrop-blur px-5 py-2.5 text-center shadow-[0_0_30px_rgba(239,68,68,0.5)]">
              <div className="flex items-center gap-2 text-red-300 font-black text-base tracking-wide">
                <TriangleAlert className="size-5" aria-hidden />
                COMBUSTÍVEL CRÍTICO
              </div>
              <div className="text-red-200/90 text-xs font-bold">
                {hud.fuelSeconds.toFixed(0)}s restantes — pegue um barril F!
              </div>
            </div>
          </div>
        )}

        {/* ---------------- Medidor de combustível (lateral) ---------------- */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10">
          <FuelGauge hud={hud} />
        </div>

        {/* ---------------- Temporizadores de armas ---------------- */}
        <div className="pointer-events-none absolute left-2.5 bottom-24 z-10 flex flex-col gap-1.5 sm:bottom-20">
          <WeaponChip
            active={hud.weapons.shield > 0}
            icon={<Shield className="size-3.5" />}
            label="ESCUDO"
            time={hud.weapons.shield}
            colorClass="text-cyan-300 border-cyan-500/50 bg-cyan-950/50"
          />
          <WeaponChip
            active={hud.weapons.triple > 0}
            icon={<Crosshair className="size-3.5" />}
            label="TRIPLO"
            time={hud.weapons.triple}
            colorClass="text-red-300 border-red-500/50 bg-red-950/50"
          />
          <WeaponChip
            active={hud.weapons.homing > 0}
            icon={<Rocket className="size-3.5" />}
            label="TELEGUIADO"
            time={hud.weapons.homing}
            colorClass="text-green-300 border-green-500/50 bg-green-950/50"
          />
          <WeaponChip
            active={hud.weapons.turbo > 0}
            icon={<Zap className="size-3.5" />}
            label="TURBO ×2"
            time={hud.weapons.turbo}
            colorClass="text-purple-300 border-purple-500/50 bg-purple-950/50"
          />
        </div>

        {/* ---------------- Controles de toque ---------------- */}
        <TouchControls gameRef={gameRef} />

        {/* ---------------- Sobreposição de pausa ---------------- */}
        {hud.paused && started && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-black/70 backdrop-blur-sm">
            <Signpost className="size-12 text-primary" aria-hidden />
            <h2 className="text-3xl font-black tracking-widest text-foreground">PAUSADO</h2>
            <div className="flex flex-col gap-2.5 w-56">
              <button
                onClick={togglePause}
                className="h-12 rounded-xl bg-primary text-primary-foreground font-black text-base hover:bg-primary/90 shadow-lg cursor-pointer"
              >
                CONTINUAR
              </button>
              <button
                onClick={onExit}
                className="h-11 rounded-xl border border-border bg-card/70 font-bold text-sm hover:bg-secondary/70 cursor-pointer"
              >
                SAIR PARA O MENU
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Tecla <kbd className="px-1.5 py-0.5 rounded bg-secondary font-mono">P</kbd> para pausar/continuar
            </p>
          </div>
        )}

        {/* ---------------- Tela inicial de clique para começar (áudio) ---------------- */}
        {ready && !started && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-black/80 backdrop-blur">
            <div className="text-center px-6">
              <h2 className="text-2xl sm:text-3xl font-black text-foreground">PREPARADO, PILOTO?</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-72">
                ← → mover · ↑ ↓ velocidade · ESPAÇO atirar · P pausar
                <br />
                Joystick conectado é detectado automaticamente.
              </p>
            </div>
            <button
              onClick={startGame}
              className="h-14 px-10 rounded-xl bg-primary text-primary-foreground font-black text-lg shadow-xl hover:bg-primary/90 hover:-translate-y-0.5 transition-all cursor-pointer"
            >
              DECOLAR
            </button>
            <button
              onClick={onExit}
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 cursor-pointer"
            >
              voltar ao menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function WeaponChip({
  active,
  icon,
  label,
  time,
  colorClass,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  time: number;
  colorClass: string;
}) {
  if (!active) return null;
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2 py-1 backdrop-blur-md shadow-lg",
        colorClass
      )}
    >
      {icon}
      <span className="text-[10px] font-black tracking-wide">{label}</span>
      <span className="text-[10px] font-bold tabular-nums">{time.toFixed(1)}s</span>
    </div>
  );
}
