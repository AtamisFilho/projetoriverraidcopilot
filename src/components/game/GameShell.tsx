"use client";

import { useCallback, useState } from "react";
import { MenuScreen } from "./MenuScreen";
import { GameScreen } from "./GameScreen";
import { GameOverScreen } from "./GameOverScreen";
import type { RunResult } from "@/lib/game/types";

/* Máquina de estados da aplicação: menu → partida → fim de jogo */

type Screen = "menu" | "playing" | "gameover";

export function GameShell() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [result, setResult] = useState<RunResult | null>(null);
  // chave para recriar o motor a cada partida
  const [runKey, setRunKey] = useState(0);

  const handlePlay = useCallback(() => {
    setRunKey((k) => k + 1);
    setScreen("playing");
  }, []);

  const handleFinished = useCallback((r: RunResult) => {
    setResult(r);
    setScreen("gameover");
  }, []);

  const handleExit = useCallback(() => setScreen("menu"), []);

  if (screen === "menu") return <MenuScreen onPlay={handlePlay} />;
  if (screen === "playing")
    return <GameScreen key={runKey} onFinished={handleFinished} onExit={handleExit} />;
  return (
    <GameOverScreen
      result={result ?? { score: 0, distanceM: 0, chapter: 1, enemiesKilled: 0, fuelCollected: 0 }}
      onRestart={handlePlay}
      onMenu={handleExit}
    />
  );
}
