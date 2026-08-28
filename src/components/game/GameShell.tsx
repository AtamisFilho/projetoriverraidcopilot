'use client';

/**
 * Casca do jogo: canvas + máquina de estados da UI (HUD, menus,
 * cutscenes, controles de toque) conectada à classe `Game`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Game, type LastRunSummary } from '@/game/Game';
import type { GameState, HudState } from '@/game/types';
import type { InputManager } from '@/game/input/input';
import { useToast } from '@/hooks/use-toast';
import { Hud } from './Hud';
import { MainMenu } from './MainMenu';
import { IntroOverlay } from './IntroOverlay';
import { PauseMenu } from './PauseMenu';
import { GameOverScreen } from './GameOverScreen';
import { TouchControls } from './TouchControls';
import { cn } from '@/lib/utils';

export function GameShell() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [state, setState] = useState<GameState>('menu');
  const [intro, setIntro] = useState<{
    title: string;
    lines: string[];
    quote?: string;
  } | null>(null);
  const [bossIntro, setBossIntro] = useState<{
    title: string;
    description: string;
    name: string;
  } | null>(null);
  const [lastRun, setLastRun] = useState<LastRunSummary | null>(null);
  const [inputManager, setInputManager] = useState<InputManager | null>(null);
  const { toast } = useToast();

  const isTouch = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches,
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const game = new Game(canvas, {
      onHud: setHud,
      onToast: (title, description) => toast({ title, description }),
      onStateChange: (s) => {
        setState(s);
        if (s === 'chapterIntro') setIntro(game.getIntroData());
        if (s === 'bossIntro') setBossIntro(game.getBossIntroData());
        if (s === 'gameover') setLastRun(game.getLastRun());
      },
    });
    gameRef.current = game;
    setInputManager(game.getInput());

    const ro = new ResizeObserver(() => game.resize());
    ro.observe(container);

    // Desbloqueio de áudio no primeiro gesto do usuário
    const unlock = () => game.ensureAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    // Hook de depuração/inspeção (útil para testes E2E)
    (window as unknown as { __riverRaid?: Game }).__riverRaid = game;

    return () => {
      ro.disconnect();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      game.destroy();
      gameRef.current = null;
    };
  }, [toast]);

  const handleNewGame = useCallback(() => gameRef.current?.newGame(), []);
  const handleContinue = useCallback(() => gameRef.current?.continueRun(), []);
  const handleConfirmIntro = useCallback(
    () => gameRef.current?.confirmIntro(),
    []
  );
  const handleResume = useCallback(() => gameRef.current?.resume(), []);
  const handleRestart = useCallback(() => gameRef.current?.newGame(), []);
  const handleSaveAndExit = useCallback(
    () => gameRef.current?.saveAndExit(),
    []
  );
  const handleMenu = useCallback(() => gameRef.current?.toMenu(), []);
  const handlePause = useCallback(() => gameRef.current?.pause(), []);
  const handleToggleMute = useCallback(() => {
    const g = gameRef.current;
    if (!g || !hud) return;
    g.setMuted(!hud.settings.muted);
  }, [hud]);
  const handleToggleRetro = useCallback(() => {
    const g = gameRef.current;
    if (!g || !hud) return;
    g.setRetro(!hud.settings.retro);
  }, [hud]);
  const handleBuyUpgrade = useCallback((id: string) => {
    return gameRef.current?.buyUpgrade(id) ?? false;
  }, []);

  const retro = hud?.settings.retro ?? false;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#031218]"
    >
      <canvas
        ref={canvasRef}
        className={cn(
          'absolute inset-0 h-full w-full',
          retro && 'image-rendering-pixelated'
        )}
        aria-label="Área do jogo River Raid Remaster"
        role="img"
      />

      {/* Filtro CRT retro (scanlines + vinheta) */}
      {retro && (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-20"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 3px)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-20"
            style={{
              boxShadow: 'inset 0 0 120px rgba(0,0,0,0.55)',
              filter: 'saturate(1.25) contrast(1.06)',
            }}
            aria-hidden
          />
        </>
      )}

      {/* HUD durante o jogo */}
      {hud && (state === 'playing' || state === 'paused') && <Hud hud={hud} />}

      {/* Controles de toque */}
      {isTouch && state === 'playing' && inputManager && (
        <TouchControls input={inputManager} onPause={handlePause} />
      )}

      {/* Overlays por estado */}
      {state === 'menu' && hud && (
        <MainMenu
          hud={hud}
          onNewGame={handleNewGame}
          onContinue={handleContinue}
          onToggleMute={handleToggleMute}
          onToggleRetro={handleToggleRetro}
          onBuyUpgrade={handleBuyUpgrade}
        />
      )}

      {state === 'chapterIntro' && intro && (
        <IntroOverlay
          title={intro.title}
          lines={intro.lines}
          quote={intro.quote}
          kind="chapter"
          onConfirm={handleConfirmIntro}
        />
      )}

      {state === 'bossIntro' && bossIntro && (
        <IntroOverlay
          title={bossIntro.title}
          lines={[bossIntro.description]}
          quote={`— ${bossIntro.name}`}
          kind="boss"
          onConfirm={handleConfirmIntro}
        />
      )}

      {state === 'paused' && hud && (
        <PauseMenu
          hud={hud}
          onResume={handleResume}
          onRestart={handleRestart}
          onSaveAndExit={handleSaveAndExit}
          onToggleMute={handleToggleMute}
          onToggleRetro={handleToggleRetro}
        />
      )}

      {state === 'gameover' && hud && (
        <GameOverScreen
          hud={hud}
          lastRun={lastRun}
          onRestart={handleRestart}
          onMenu={handleMenu}
        />
      )}
    </div>
  );
}
