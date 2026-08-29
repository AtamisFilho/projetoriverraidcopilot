/**
 * Testes adversariais — integração headless da classe Game
 * ---------------------------------------------------------
 * Drive o motor (update 60 Hz) com canvas/window stubados e valida:
 * crash por save corrompido, corrupção de profile por NaN, gatilho
 * de chefe, respawn, game over e persistência do checkpoint.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { createGame, resetStorage, setRawStorage, priv } from './helpers';
import { stageEndY, stageStartY } from '@/game/systems/stages';
import type { Game } from '@/game/Game';
import type { HudState } from '@/game/types';

interface GamePriv {
  update(dt: number): void;
  stage: number;
  scrollY: number;
  H: number;
  fuel: number;
  lives: number;
  score: { points: number; nextLifeAt: number };
  boss: { id: number; hp: number; maxHp: number; dying: boolean; active: boolean; entered: boolean; update(ctx: unknown): void; hit(dmg?: number): void } | null;
  pendingBoss: { id: number; hpScale: number } | null;
  bossTriggered: boolean;
  bridge: { worldY: number; hp: number; broken: boolean } | null;
  player: {
    x: number; y: number; alive: boolean; invincible: number;
    shield: number; stats: { speed: number };
  };
  enemies: unknown[];
  profile: {
    credits: number; bestScore: number;
    localScores: { name: string; score: number; stage: number; date: string }[];
    upgrades: Record<string, number>;
  };
  deathTimer: number;
  input: { setTouchAxis(x: number, y: number): void; setTouchFire(on: boolean): void };
  crash(): void;
  respawn(): void;
  finishGameOver(): void;
  saveCheckpoint(): void;
  placePlayerInRiver(): void;
  updateSpawns(dt: number): void;
  pickups: { powerups: { x: number; worldY: number; kind: string; active: boolean }[]; depots: { x: number; worldY: number; kind: string; active: boolean }[] };
  destroyBridge(): void;
}

beforeEach(() => {
  resetStorage();
});

describe('Game — ciclo básico', () => {
  test('constrói em estado menu e sincroniza HUD', async () => {
    const h = await createGame();
    expect(h.state()).toBe('menu');
    expect(h.lastHud()).toBeTruthy();
    expect(h.lastHud().state).toBe('menu');
  });

  test('newGame → intro de capítulo → confirmIntro → playing', async () => {
    const h = await createGame();
    h.game.newGame();
    expect(h.state()).toBe('chapterIntro');
    h.game.confirmIntro();
    expect(h.state()).toBe('playing');
  });

  test('simulação roda 600 frames sem lançar e HUD atualiza', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    expect(() => h.step(600)).not.toThrow();
    const hud = h.lastHud();
    expect(hud.stage).toBe(1);
    expect(hud.fuel).toBeLessThan(100); // consumiu combustível
    expect(hud.fuel).toBeGreaterThanOrEqual(0);
  });
});

describe('Game — continueRun com saves corrompidos (branch rejeitado)', () => {
  const RUN_KEY = 'riverraid_remaster_run_v1';

  test('save sem missions NÃO derruba a app (antes: TypeError → tela branca)', async () => {
    setRawStorage(
      RUN_KEY,
      JSON.stringify({ version: 1, seed: 42, stage: 2, score: 800, lives: 3, savedAt: 1 })
    );
    const h = await createGame();
    expect(() => h.game.continueRun()).not.toThrow();
    // save inválido → rejeitado → continua no menu
    expect(h.state()).toBe('menu');
  });

  // Este cenário TRAVA o motor de forma síncrona (loop infinito no
  // River.stageAt). Roda em subprocesso com timeout: se o motor travar,
  // o filho é morto e o teste FALHA em vez de congelar a suíte inteira.
  test('save com stage 1e300 é rejeitado (antes: engine travava)', async () => {
    const script = `
      const store = new Map();
      globalThis.localStorage = {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
      };
      globalThis.window = { addEventListener(){}, removeEventListener(){}, devicePixelRatio: 1 };
      globalThis.requestAnimationFrame = () => 1;
      store.set('riverraid_remaster_run_v1', JSON.stringify({
        version: 1, seed: 1, stage: 1e300, score: 0, lives: 3,
        missions: [], savedAt: 1,
      }));
      const ctxStub = new Proxy(function(){}, {
        get: () => ctxStub, set: () => true, apply: () => ctxStub,
      });
      const canvas = {
        getContext: () => ctxStub,
        getBoundingClientRect: () => ({ width: 960, height: 600 }),
      };
      const { Game } = await import('${import.meta.dir}/../src/game/Game');
      const g = new Game(canvas, { onHud(){}, onToast(){}, onStateChange(){} });
      g.continueRun();
      console.log('RESULT:' + g.state);
    `;
    const proc = Bun.spawnSync(['bun', '-e', script], {
      timeout: 8000,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const out = new TextDecoder().decode(proc.stdout);
    // Se o motor travar, o timeout mata o processo → sem RESULT no stdout
    expect(out).toContain('RESULT:menu');
  }, 15000);

  test('save com score NaN-like (string) é rejeitado', async () => {
    setRawStorage(
      RUN_KEY,
      JSON.stringify({
        version: 1, seed: 1, stage: 2, score: 'NaN', lives: 3,
        missions: [], savedAt: 1,
      })
    );
    const h = await createGame();
    expect(() => h.game.continueRun()).not.toThrow();
    expect(h.state()).toBe('menu');
  });

  test('save válido restaura score/fase/lives', async () => {
    setRawStorage(
      RUN_KEY,
      JSON.stringify({
        version: 1, seed: 42, stage: 5, score: 12345, lives: 2,
        missions: [
          { id: 'destroy_20', progress: 3, completed: false, rewardGiven: false },
        ],
        savedAt: Date.now(),
      })
    );
    const h = await createGame();
    h.game.continueRun();
    // fase 5 não é início de capítulo → vai direto para playing
    expect(h.state()).toBe('playing');
    const hud = h.lastHud();
    expect(hud.score).toBe(12345);
    expect(hud.stage).toBe(5);
    expect(hud.lives).toBe(2);
  });

  test('save em fase de início de capítulo mostra a intro', async () => {
    setRawStorage(
      RUN_KEY,
      JSON.stringify({
        version: 1, seed: 42, stage: 4, score: 100, lives: 3,
        missions: [], savedAt: Date.now(),
      })
    );
    const h = await createGame();
    h.game.continueRun();
    expect(h.state()).toBe('chapterIntro');
    expect(h.lastHud().chapterTitle).toContain('Capítulo 2');
  });
});

describe('Game — corrupção de profile por NaN (defesa em profundidade)', () => {
  test('finishGameOver com score NaN não corrompe o profile', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    g.score.points = Number.NaN; // simula corrupção em runtime
    g.lives = 0;
    g.finishGameOver();
    expect(Number.isFinite(g.profile.bestScore)).toBe(true);
    expect(g.profile.bestScore).toBe(0);
    expect(Number.isFinite(g.profile.credits)).toBe(true);
    // lastRun também deve ser finito
    const run = h.game.getLastRun();
    expect(Number.isFinite(run!.score)).toBe(true);
    expect(run!.score).toBe(0);
  });

  test('buyUpgrade com credits NaN retorna false (antes: compra grátis!)', async () => {
    const h = await createGame();
    const g = priv<GamePriv>(h.game);
    g.profile.credits = Number.NaN;
    expect(h.game.buyUpgrade('speed')).toBe(false);
    expect(g.profile.upgrades.speed ?? 0).toBe(0);
  });

  test('buyUpgrade com credits negativos retorna false', async () => {
    const h = await createGame();
    const g = priv<GamePriv>(h.game);
    g.profile.credits = -500;
    expect(h.game.buyUpgrade('speed')).toBe(false);
  });

  test('buyUpgrade válido desconta e persiste', async () => {
    const h = await createGame();
    const g = priv<GamePriv>(h.game);
    g.profile.credits = 1000;
    expect(h.game.buyUpgrade('speed')).toBe(true);
    expect(g.profile.credits).toBe(1000 - 150);
    expect(g.profile.upgrades.speed).toBe(1);
    expect(h.game.buyUpgrade('id_inexistente')).toBe(false);
  });
});

describe('Game — morte, respawn e game over', () => {
  test('crash decrementa vida e respawna com invencibilidade', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    const livesBefore = g.lives;
    g.crash();
    expect(g.player.alive).toBe(false);
    expect(g.lives).toBe(livesBefore - 1);
    // avança o deathTimer
    for (let i = 0; i < 120; i++) g.update(1 / 60); // 2s
    expect(g.player.alive).toBe(true);
    expect(g.player.invincible).toBeGreaterThan(0);
  });

  test('última vida → game over com resumo e créditos', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    g.lives = 1;
    g.score.points = 2500;
    g.crash();
    for (let i = 0; i < 150; i++) g.update(1 / 60);
    expect(h.state()).toBe('gameover');
    const run = h.game.getLastRun()!;
    expect(run.score).toBe(2500);
    expect(run.credits).toBe(50); // 2500/50
    expect(g.profile.bestScore).toBe(2500);
    expect(g.profile.credits).toBe(50);
    expect(g.profile.localScores[0].score).toBe(2500);
  });

  test('morte por combustível esgotado', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    g.fuel = 0.01;
    h.step(5);
    expect(g.player.alive).toBe(false);
  });

  test('game over limpa o checkpoint salvo', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    g.saveCheckpoint();
    expect(h.game.hasSavedRun()).toBe(true);
    g.lives = 1;
    g.crash();
    for (let i = 0; i < 150; i++) g.update(1 / 60);
    expect(h.state()).toBe('gameover');
    expect(h.game.hasSavedRun()).toBe(false);
  });
});

describe('Game — chefe e avanço de fase', () => {
  test('gatilho do chefe na fase 3 → intro → spawn → derrota → fase 4', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    // pula direto para o fim da fase 3 (50px além do gatilho)
    g.stage = 3;
    g.scrollY = stageEndY(3) - 1500 - g.H + 50;
    h.step(5);
    expect(h.state()).toBe('bossIntro');
    expect(g.pendingBoss).not.toBeNull();
    expect(g.pendingBoss!.id).toBe(1);
    h.game.confirmIntro();
    expect(h.state()).toBe('playing');
    expect(g.boss).not.toBeNull();
    expect(g.boss!.id).toBe(1);
    // mata o chefe
    for (let i = 0; i < g.boss!.maxHp; i++) g.boss!.hit(1);
    expect(g.boss!.dying).toBe(true);
    for (let i = 0; i < 200; i++) g.update(1 / 60);
    expect(g.stage).toBe(4);
    expect(g.boss).toBeNull();
  });

  test('IDs dos chefes ciclam no modo infinito (12→1, 15→2, 18→3)', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    for (const [stage, expectedId] of [
      [12, 1], [15, 2], [18, 3],
    ] as const) {
      g.stage = stage;
      g.bossTriggered = false;
      g.pendingBoss = null;
      g.scrollY = stageEndY(stage) - 1500 - g.H + 50;
      h.step(5);
      expect(h.state()).toBe('bossIntro');
      expect(g.pendingBoss!.id).toBe(expectedId);
      // hpScale do ciclo 2 = 1.35
      expect(g.pendingBoss!.hpScale).toBeCloseTo(1.35, 10);
      h.game.confirmIntro();
      g.boss!.hit(g.boss!.maxHp); // mata instantaneamente
      // aguarda a agonia + avanço, tolerando mortes ocasionais do
      // jogador durante a espera (inimigos continuam spawnando)
      let guard = 0;
      while (
        (g.stage !== stage + 1 || !g.player.alive) &&
        guard++ < 1500
      ) {
        g.update(1 / 60);
      }
      // limpa o campo para a próxima iteração
      g.enemies = [];
      (h.game as unknown as { enemyBullets: { list: unknown[] } }).enemyBullets.list = [];
      g.player.invincible = 3;
      g.lives = 3; // mortes ocasionais durante a espera não podem destruir o ciclo
      expect(g.stage).toBe(stage + 1);
    }
  });

  test('fase de chefe não cria ponte', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    // simulando a entrada real na fase 3 (advanceStage chama createBridgeFor)
    g.stage = 3;
    (h.game as unknown as { createBridgeFor(s: number): void }).createBridgeFor(3);
    expect(g.bridge).toBeNull();
    g.scrollY = stageEndY(3) - 1500 - g.H + 50;
    h.step(5);
    h.game.confirmIntro();
    expect(g.boss).not.toBeNull();
  });

  test('respawn durante luta de chefe reseta o gatilho (retry clássico)', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    g.stage = 3;
    (h.game as unknown as { createBridgeFor(s: number): void }).createBridgeFor(3);
    g.scrollY = stageEndY(3) - 1500 - g.H + 50;
    h.step(5);
    h.game.confirmIntro();
    expect(g.boss).not.toBeNull();
    g.crash();
    for (let i = 0; i < 120; i++) g.update(1 / 60);
    // respawn voltou ao início da fase 3 sem chefe
    expect(g.player.alive).toBe(true);
    expect(g.boss).toBeNull();
    expect(g.bossTriggered).toBe(false);
    // o mundo voltou para perto do início da fase (o jogador pode ter
    // avançado alguns px durante os frames restantes após o respawn)
    expect(g.scrollY).toBeLessThan(stageStartY(3) + 500);
    expect(g.scrollY).toBeLessThan(stageEndY(3) - 1500 - g.H); // longe do gatilho
  });

  test('ponte destruída avança a fase e salva checkpoint', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    expect(g.bridge).not.toBeNull();
    expect(g.bridge!.broken).toBe(false);
    g.destroyBridge();
    expect(g.stage).toBe(2);
    expect(h.game.hasSavedRun()).toBe(true);
    // a ponte da fase 2 (intacta) substitui a antiga
    expect(g.bridge!.broken).toBe(false);
    expect(g.bridge!.worldY).toBeGreaterThan(0);
  });

  test('checkpoints sucessivos sobrescrevem o save', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    g.destroyBridge(); // fase 2
    g.destroyBridge(); // fase 3
    const run = JSON.parse(
      localStorage.getItem('riverraid_remaster_run_v1')!
    ) as { stage: number };
    expect(run.stage).toBe(3);
  });
});

describe('Game — power-ups e depósitos', () => {
  test('power-up aplicado dá timer ao jogador (tipos independentes)', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    g.player.applyPowerUp('shield');
    expect(g.player.shield).toBeGreaterThan(0);
    g.player.applyPowerUp('turbo');
    expect(g.player.turbo).toBeGreaterThan(0);
    expect(g.player.shield).toBeGreaterThan(0); // timer do escudo persiste
  });

  test('escudo não deixa colisão com margem matar (comportamento clássico do power-up)', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    g.player.shield = 5;
    g.player.x = 5; // fora da água (esquerda)
    h.step(3);
    expect(g.player.alive).toBe(true);
  });

  test('spawn de power-up usa canal navegável (nunca em cima da ilha)', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    // força muitos spawns e valida cada power-up contra a forma do rio
    let checked = 0;
    for (let i = 0; i < 400; i++) {
      g.updateSpawns(1 / 60);
      g.scrollY += 400; // empurra o mundo para gerar mais
    }
    for (const p of g.pickups.powerups) {
      const shape = (h.game as unknown as {
        river: { shapeAt(wy: number): { left: number; right: number; islandLeft: number; islandRight: number; hasIsland: boolean } };
      }).river.shapeAt(p.worldY);
      expect(p.x / 960).toBeGreaterThanOrEqual(shape.left);
      expect(p.x / 960).toBeLessThanOrEqual(shape.right);
      if (shape.hasIsland) {
        const inside = p.x / 960 > shape.islandLeft && p.x / 960 < shape.islandRight;
        expect(inside).toBe(false);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('Game — pausa e estado', () => {
  test('pausa congela a simulação e retoma', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    const fuelBefore = g.fuel;
    h.game.pause();
    expect(h.state()).toBe('paused');
    h.step(120);
    expect(g.fuel).toBe(fuelBefore); // congelado
    h.game.resume();
    expect(h.state()).toBe('playing');
    h.step(60);
    expect(g.fuel).toBeLessThan(fuelBefore);
  });

  test('pause fora de playing é ignorado', async () => {
    const h = await createGame();
    expect(() => h.game.pause()).not.toThrow();
    expect(h.state()).toBe('menu');
  });

  test('saveAndExit persiste e volta ao menu', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    g.score.points = 777;
    h.game.saveAndExit();
    expect(h.state()).toBe('menu');
    expect(h.game.hasSavedRun()).toBe(true);
  });

  test('toMenu interrompe sem salvar', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    h.game.toMenu();
    expect(h.state()).toBe('menu');
  });
});

describe('Game — HUD', () => {
  test('HUD expõe todos os campos obrigatórios', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    h.step(30);
    const hud: HudState = h.lastHud();
    const keys: (keyof HudState)[] = [
      'state', 'score', 'hiScore', 'credits', 'fuel', 'fuelMax', 'lives',
      'stage', 'chapterTitle', 'combo', 'comboActive', 'speedKmh',
      'powerUps', 'boss', 'missions', 'checkpointStage', 'runActive',
      'canContinue', 'upgrades', 'settings', 'campaignDone',
      'gamepadConnected', 'localScores',
    ];
    for (const k of keys) expect(hud[k]).toBeDefined();
    expect(Number.isFinite(hud.fuel)).toBe(true);
    expect(Number.isFinite(hud.speedKmh)).toBe(true);
  });

  test('hiScore nunca é NaN', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    g.profile.bestScore = 5000;
    g.score.points = 3000;
    h.step(10);
    expect(Number.isFinite(h.lastHud().hiScore)).toBe(true);
  });
});

describe('Game — render não lança com ctx stubado', () => {
  test('render em vários estados', async () => {
    const h = await createGame();
    const render = (h.game as unknown as { render(): void }).render.bind(h.game);
    expect(() => render()).not.toThrow(); // menu
    h.game.newGame();
    expect(() => render()).not.toThrow(); // chapterIntro
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    h.step(120);
    expect(() => render()).not.toThrow(); // playing
    g.crash();
    h.step(120);
    expect(() => render()).not.toThrow(); // gameover
  });
});
