"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Gauge,
  Heart,
  MapPin,
  Move,
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
import type { HudState, RunResult, StartOptions } from "@/lib/game/types";
import { saveRun } from "@/lib/game/save";
import { FuelGauge } from "./FuelGauge";
import { VirtualControls, useTouchMode } from "./VirtualControls";
import { cn } from "@/lib/utils";

const initialHud: HudState = {
  score: 0,
  combo: 0,
  emp: 2,
  fuel: 100,
  fuelSeconds: 60,
  fuelCritical: false,
  speedKmh: 140,
  lives: 3,
  level: 1,
  chapter: 1,
  chapterName: "Nascente do Rio",
  distanceM: 0,
  weapons: { shield: 0, triple: 0, homing: 0, turbo: 0 },
  bossActive: false,
  bossName: "",
  bossHpPct: 0,
  paused: false,
};

/** Altura da barra inferior de controles (deck) — área do jogo fica acima */
const DECK_H = 176;

interface Props {
  startCfg: StartOptions;
  onFinished: (r: RunResult) => void;
  onExit: () => void;
}

export function GameScreen({ startCfg, onFinished, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<RiverRaidGame | null>(null);
  const [hud, setHud] = useState<HudState>({ ...initialHud, lives: startCfg.lives });
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const touchMode = useTouchMode();

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
    g.start(startCfg);
    setStarted(true);
  }, [startCfg]);

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

  /** Persiste o ponto atual da partida (continuar depois) — o fim de jogo
   * é salvo pelo próprio motor dentro de endGame() */
  const saveCurrentRun = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const s = g.getRunState();
    if (s) saveRun(s);
  }, []);

  const handleExit = useCallback(() => {
    saveCurrentRun();
    onExit();
  }, [onExit, saveCurrentRun]);

  // checkpoint automático sempre que o jogo pausa (inclusive em segundo plano)
  useEffect(() => {
    if (hud.paused && started) saveCurrentRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hud.paused]);

  const critical = hud.fuelCritical && started;
  const maxLives = Math.max(3, Math.min(startCfg.lives, 6));

  return (
    <div className="w-full h-dvh flex flex-col items-center bg-background relative overflow-hidden">
      {/* Área do jogo — FICA ACIMA da barra de controles; o dedo nunca cobre o rio */}
      <div
        className="relative bg-black shrink-0"
        style={{
          height: touchMode ? `calc(100dvh - ${DECK_H}px)` : "100dvh",
          aspectRatio: "9 / 16",
          maxWidth: "100vw",
        }}
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

          {/* Nível / capítulo / distância / vidas */}
          <div className="flex flex-col items-center gap-1">
            <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-md px-3 py-1 shadow-lg text-center">
              <div className="text-[9px] font-black tracking-widest text-muted-foreground">
                NÍVEL {hud.level} · CAP {hud.chapter}
              </div>
              <div className="text-[11px] font-bold text-foreground/90 leading-tight max-w-36 truncate">
                {hud.chapterName}
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-cyan-300 tabular-nums justify-center">
                <MapPin className="size-3" aria-hidden />
                {hud.distanceM.toLocaleString("pt-BR")} m
              </div>
            </div>
            <div className="flex gap-0.5" aria-label={`${hud.lives} naves restantes`}>
              {Array.from({ length: maxLives }).map((_, i) => (
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
            {/* Medidor de combustível compacto — logo abaixo do botão de pausa */}
            <FuelGauge hud={hud} />
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
          {/* cargas do pulso EMP (gatilho) */}
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2 py-1 backdrop-blur-md shadow-lg",
              hud.emp > 0
                ? "text-sky-300 border-sky-400/50 bg-sky-950/50"
                : "text-muted-foreground/60 border-border/50 bg-card/50"
            )}
            aria-label={`${hud.emp} cargas de pulso EMP restantes`}
          >
            <Zap className="size-3.5" aria-hidden />
            <span className="text-[10px] font-black tracking-wide">EMP</span>
            <span className="text-[10px] font-bold tabular-nums">×{hud.emp}</span>
          </div>
        </div>

        {/* ---------------- Sobreposição de pausa ---------------- */}
        {hud.paused && started && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-black/70 backdrop-blur-sm">
            <Signpost className="size-12 text-primary" aria-hidden />
            <h2 className="text-3xl font-black tracking-widest text-foreground">PAUSADO</h2>
            <p className="text-xs text-muted-foreground -mt-3 tabular-nums">
              Nível {hud.level} · {hud.distanceM.toLocaleString("pt-BR")} m ·{" "}
              {hud.score.toLocaleString("pt-BR")} pts
            </p>
            <div className="flex flex-col gap-2.5 w-56">
              <button
                onClick={togglePause}
                className="h-12 rounded-xl bg-primary text-primary-foreground font-black text-base hover:bg-primary/90 shadow-lg cursor-pointer"
              >
                CONTINUAR
              </button>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("rr-reset-controls"))
                }
                className="h-11 rounded-xl border border-border bg-card/70 font-bold text-sm hover:bg-secondary/70 cursor-pointer"
              >
                REDEFINIR CONTROLES DE TOQUE
              </button>
              <button
                onClick={handleExit}
                className="h-11 rounded-xl border border-border bg-card/70 font-bold text-sm hover:bg-secondary/70 cursor-pointer"
              >
                SAIR PARA O MENU
              </button>
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-64 leading-relaxed">
              <Move className="inline size-3 -mt-0.5 mr-1" aria-hidden />
              Na barra inferior os controles podem ser arrastados enquanto o
              jogo estiver pausado.
              <br />
              Tecla <kbd className="px-1.5 py-0.5 rounded bg-secondary font-mono">P</kbd> para
              pausar/continuar ·{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-secondary font-mono">K</kbd> dispara o
              pulso EMP
            </p>
          </div>
        )}

        {/* ---------------- Tela inicial de clique para começar (áudio) ---------------- */}
        {ready && !started && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-black/80 backdrop-blur">
            <div className="text-center px-6">
              <h2 className="text-2xl sm:text-3xl font-black text-foreground">
                PREPARADO, PILOTO?
              </h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-72">
                Começando no <strong className="text-foreground/90">nível {startCfg.level}</strong>{" "}
                com <strong className="text-foreground/90">{startCfg.lives} naves</strong>.
                <br />
                ← → mover · ↑ ↓ velocidade · ESPAÇO atirar · K pulso EMP · P pausar
                <br />
                No toque: joystick e botões na barra inferior — antes de decolar
                você pode arrastá-los para a posição que preferir.
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
              onClick={handleExit}
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 cursor-pointer"
            >
              voltar ao menu
            </button>
          </div>
        )}
      </div>

      {/* ---------------- Barra inferior de controles (deck) ----------------
       * Exclusiva para telas de toque: o jogo corre ACIMA dela e os botões
       * ficam sempre na parte inferior da tela. O arrasto para reposicionar
       * só funciona antes do início da partida ou pausado (canEdit). */}
      {touchMode && (
        <div
          className="relative w-full shrink-0 border-t border-border/60 bg-[#0a1410]/95"
          style={{ height: DECK_H }}
          aria-label="Barra de controles de toque"
        >
          <VirtualControls
            gameRef={gameRef}
            emp={hud.emp}
            canEdit={!started || hud.paused}
          />
        </div>
      )}
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
