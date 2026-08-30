"use client";

import { useCallback, useState } from "react";
import { MenuScreen } from "./MenuScreen";
import { GameScreen } from "./GameScreen";
import { GameOverScreen } from "./GameOverScreen";
import { loadConfig, loadRun, type RunSave } from "@/lib/game/save";
import type { RunResult, StartOptions } from "@/lib/game/types";

/* Máquina de estados da aplicação: menu → partida → fim de jogo.
 * Carrega a configuração da missão (naves/nível) e o progresso salvo
 * (localStorage) para montar as opções de início da partida. */

type Screen = "menu" | "playing" | "gameover";

const FALLBACK_RESULT: RunResult = {
  score: 0,
  distanceM: 0,
  level: 1,
  chapter: 1,
  enemiesKilled: 0,
  fuelCollected: 0,
};

export function GameShell() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [result, setResult] = useState<RunResult | null>(null);
  // opções usadas pela partida corrente (nível, naves, retomada)
  const [startCfg, setStartCfg] = useState<StartOptions>({ level: 1, lives: 3 });
  // chave para recriar o motor a cada partida
  const [runKey, setRunKey] = useState(0);

  const startRun = useCallback((cfg: StartOptions) => {
    setStartCfg(cfg);
    setRunKey((k) => k + 1);
    setScreen("playing");
  }, []);

  /** Nova missão com a configuração escolhida no menu */
  const handlePlay = useCallback(
    (cfg: StartOptions) => startRun(cfg),
    [startRun]
  );

  /** Continuar do ponto salvo (nível/distância/pontuação retomados) */
  const continueFromSave = useCallback(
    (save: RunSave) => {
      const cfg = loadConfig();
      startRun({
        level: save.level,
        // saiu no meio da partida? as naves restantes voltam junto
        lives: save.lives > 0 ? save.lives : cfg.lives,
        distanceM: save.distanceM,
        score: save.score,
        enemiesKilled: save.enemiesKilled,
        fuelCollected: save.fuelCollected,
      });
    },
    [startRun]
  );

  const handleContinueMenu = useCallback(
    (save: RunSave) => continueFromSave(save),
    [continueFromSave]
  );

  /** Fim de jogo → CONTINUAR do ponto onde perdeu */
  const handleContinueGameOver = useCallback(() => {
    const save = loadRun();
    if (save) continueFromSave(save);
  }, [continueFromSave]);

  /** Fim de jogo → nova partida com a configuração do menu */
  const handleRestart = useCallback(() => {
    const c = loadConfig();
    startRun({ level: c.startLevel, lives: c.lives });
  }, [startRun]);

  const handleFinished = useCallback((r: RunResult) => {
    setResult(r);
    setScreen("gameover");
  }, []);

  const handleExit = useCallback(() => setScreen("menu"), []);

  if (screen === "menu") return <MenuScreen onPlay={handlePlay} onContinue={handleContinueMenu} />;
  if (screen === "playing")
    return (
      <GameScreen
        key={runKey}
        startCfg={startCfg}
        onFinished={handleFinished}
        onExit={handleExit}
      />
    );
  return (
    <GameOverScreen
      result={result ?? FALLBACK_RESULT}
      onRestart={handleRestart}
      onMenu={handleExit}
      onContinue={handleContinueGameOver}
    />
  );
}
