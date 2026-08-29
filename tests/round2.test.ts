/**
 * Round 2 — testes adjacentes às correções do Round 1
 * ----------------------------------------------------
 * Cada correção abre espaço para bugs vizinhos: limites exatos do
 * RateLimiter, boundaries do gatilho de chefe, spawns de depósitos,
 * roundtrip de missões no continueRun e edges do sanitizeLimit.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import type { NextRequest } from 'next/server';
import { RateLimiter, sanitizeLimit, clientIpFrom } from '@/lib/api-helpers';
import { makeFakeDb } from './fake-db';
import { createGame, priv, resetStorage, setRawStorage } from './helpers';
import { stageEndY, stageStartY } from '@/game/systems/stages';
import { MissionSystem } from '@/game/systems/missions';
import type { Game } from '@/game/Game';

// ---------------------------------------------------------------------------
// RateLimiter — semântica exata com relógio injetado
// ---------------------------------------------------------------------------

describe('RateLimiter (relógio injetado)', () => {
  test('primeira tentativa libera; dentro da janela bloqueia; após libera', () => {
    const rl = new RateLimiter(5000);
    expect(rl.tryAcquire('a', 1000)).toBe(true);
    expect(rl.tryAcquire('a', 1000 + 4999)).toBe(false);
    expect(rl.tryAcquire('a', 1000 + 5000)).toBe(true); // janela expirou
  });

  test('chaves independentes', () => {
    const rl = new RateLimiter(5000);
    expect(rl.tryAcquire('a', 1)).toBe(true);
    expect(rl.tryAcquire('b', 1)).toBe(true);
    expect(rl.tryAcquire('a', 2)).toBe(false);
    expect(rl.tryAcquire('b', 2)).toBe(false);
  });

  test('tentaiva bloqueada NÃO renova a janela', () => {
    const rl = new RateLimiter(5000);
    rl.tryAcquire('a', 1000);
    rl.tryAcquire('a', 3000); // bloqueada — não deve regravar 3000
    expect(rl.tryAcquire('a', 5999)).toBe(false); // ainda na janela de 1000
    expect(rl.tryAcquire('a', 6001)).toBe(true); // expirou a partir de 1000
  });

  test('poda entradas expiradas quando o mapa enche', () => {
    const rl = new RateLimiter(1000, 10);
    for (let i = 0; i < 10; i++) rl.tryAcquire(`old-${i}`, 0);
    // todas expiradas; chave nova força a poda sem crescer além do cap
    expect(rl.tryAcquire('new', 5000)).toBe(true);
    expect(rl.size).toBeLessThanOrEqual(10);
    // as antigas foram podadas — 'old-0' pode agir de novo
    expect(rl.tryAcquire('old-0', 5001)).toBe(true);
  });

  test('sob inundação de chaves únicas o mapa se reinicia (anti-OOM)', () => {
    const rl = new RateLimiter(60_000, 50); // janela longa: nada expira
    for (let i = 0; i < 500; i++) rl.tryAcquire(`flood-${i}`, 1000);
    expect(rl.size).toBeLessThanOrEqual(50);
    // e continua funcional depois do reset
    expect(rl.tryAcquire('depois', 2000)).toBe(true);
    expect(rl.tryAcquire('depois', 2001)).toBe(false);
  });

  test('mesma chave re-gravada não dispara o reset sob carga', () => {
    const rl = new RateLimiter(60_000, 5);
    for (let i = 0; i < 20; i++) rl.tryAcquire('fixa', 1000 + i);
    expect(rl.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// sanitizeLimit / clientIpFrom — edges diretos
// ---------------------------------------------------------------------------

describe('sanitizeLimit', () => {
  test.each([
    [null, 10],
    ['', 10],
    ['   ', 10],
    ['abc', 10],
    ['NaN', 10],
    ['Infinity', 50], // infinito explícito → clamp no máximo
    ['1e400', 50], // Infinity → clamp no máximo
    ['-Infinity', 1],
    ['3', 3],
    ['2.5', 2], // truncado — Prisma exige Int
    ['2.9', 2],
    ['-5', 1],
    ['0', 1],
    ['99999', 50],
    ['0x10', 16], // Number aceita hex
    ['1e2', 50], // 100 → clamp 50
  ])('sanitizeLimit(%p) → %p', (raw, expected) => {
    expect(sanitizeLimit(raw)).toBe(expected);
  });

  test('fallback/min/max customizados', () => {
    expect(sanitizeLimit(null, 7, 1, 20)).toBe(7);
    expect(sanitizeLimit('999', 7, 1, 20)).toBe(20);
    expect(sanitizeLimit('-3', 7, 2, 20)).toBe(2);
  });
});

describe('clientIpFrom', () => {
  test.each([
    [null, 'local'],
    ['', 'local'],
    ['   ', 'local'], // só espaços → vazio após trim
    ['1.2.3.4', '1.2.3.4'],
    ['1.2.3.4, 5.6.7.8', '1.2.3.4'],
    ['  1.2.3.4  , 5.6.7.8', '1.2.3.4'],
    ['x'.repeat(65), 'local'], // gigante → local
    [','.repeat(10), 'local'],
  ])('clientIpFrom(%p) → %p', (raw, expected) => {
    expect(clientIpFrom(raw)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// API — edges adicionais do Round 2
// ---------------------------------------------------------------------------

const fakeDb = makeFakeDb();
mock.module('@/lib/db', () => ({ db: fakeDb.db }));
const { GET, POST } = await import('@/app/api/scores/route');

function makeGet(path: string): NextRequest {
  const r = new Request(`http://localhost:3000${path}`) as Request & {
    nextUrl?: URL;
  };
  r.nextUrl = new URL(r.url);
  return r as unknown as NextRequest;
}

function makePost(body: string, xff: string): NextRequest {
  const r = new Request('http://localhost:3000/api/scores', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': xff,
    },
  }) as Request & { nextUrl?: URL };
  r.nextUrl = new URL(r.url);
  return r as unknown as NextRequest;
}

beforeEach(() => {
  fakeDb.reset([]);
});

describe('API — edges do Round 2', () => {
  test('GET devolve apenas campos da whitelist (sem kills)', async () => {
    await POST(
      makePost(
        JSON.stringify({ name: 'X', score: 10, stage: 1, kills: 42 }),
        '172.16.0.1'
      )
    );
    const res = await GET(makeGet('/api/scores'));
    const data = await res.json();
    const row = data.scores[0] as Record<string, unknown>;
    expect(Object.keys(row).sort()).toEqual(
      ['createdAt', 'id', 'name', 'score', 'stage']
    );
  });

  test('GET ?limit=0 → 1 (mínimo explícito, não fallback)', async () => {
    fakeDb.reset([{ name: 'A', score: 1, stage: 1 }]);
    const res = await GET(makeGet('/api/scores?limit=0'));
    expect(res.status).toBe(200);
    expect((await res.json()).scores).toHaveLength(1);
  });

  test('GET ?limit=0x10 (hex) não derruba a rota', async () => {
    fakeDb.reset(
      Array.from({ length: 20 }, (_, i) => ({ name: `P${i}`, score: i, stage: 1 }))
    );
    const res = await GET(makeGet('/api/scores?limit=0x10'));
    expect(res.status).toBe(200);
    expect((await res.json()).scores).toHaveLength(16);
  });

  test('name com 16 chars úteis após trim de espaços → 200', async () => {
    const res = await POST(
      makePost(
        JSON.stringify({
          name: '  abcdefghijklmnop  ',
          score: 10,
          stage: 1,
        }),
        '172.16.0.2'
      )
    );
    expect(res.status).toBe(200);
    expect(fakeDb.created[0].name).toBe('abcdefghijklmnop');
  });

  test('rank com empate devolve a mesma posição', async () => {
    fakeDb.reset([{ name: 'empatado', score: 1000, stage: 1 }]);
    const res = await POST(
      makePost(JSON.stringify({ name: 'X', score: 1000, stage: 1 }), '172.16.0.3')
    );
    const data = await res.json();
    expect(data.rank).toBe(1); // ninguém é melhor → também é #1
  });

  test('429 tem prioridade sobre 400 (rate-limit antes da validação)', async () => {
    const ip = '172.16.0.4';
    const first = await POST(makePost('lixo total', ip));
    expect(first.status).toBe(400);
    const second = await POST(makePost('lixo total', ip));
    expect(second.status).toBe(429);
    const third = await POST(
      makePost(JSON.stringify({ name: 'X', score: 1, stage: 1 }), ip)
    );
    expect(third.status).toBe(429); // payload válido também espera a janela
  });
});

// ---------------------------------------------------------------------------
// Game — boundaries do gatilho de chefe e roundtrip de missões
// ---------------------------------------------------------------------------

interface GamePriv {
  update(dt: number): void;
  stage: number;
  scrollY: number;
  H: number;
  fuel: number;
  lives: number;
  score: { points: number };
  boss: unknown | null;
  bossTriggered: boolean;
  pendingBoss: { id: number; hpScale: number } | null;
  bridge: { worldY: number; hp: number; broken: boolean } | null;
  player: { x: number; y: number; alive: boolean; invincible: number };
  enemies: unknown[];
  profile: { credits: number; bestScore: number };
  pickups: {
    powerups: { x: number; worldY: number; kind: string; active: boolean }[];
    depots: { x: number; worldY: number; kind: string; active: boolean }[];
  };
  updateSpawns(dt: number): void;
  destroyBridge(): void;
  saveCheckpoint(): void;
  missions: MissionSystem;
}

describe('Game — boundaries do gatilho de chefe (Round 2)', () => {
  beforeEach(() => {
    resetStorage();
  });

  test('scrollY bem ABAIXO do gatilho não dispara; acima dispara', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    g.stage = 3;
    g.scrollY = stageEndY(3) - 1500 - g.H - 300; // bem abaixo (1 frame ~3px)
    h.step(1);
    expect(h.state()).toBe('playing'); // ainda não
    g.scrollY = stageEndY(3) - 1500 - g.H + 1; // 1px acima
    h.step(1);
    expect(h.state()).toBe('bossIntro'); // agora sim
  });

  test('fase NÃO-chefe nunca dispara gatilho (fase 4)', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    g.stage = 4; // não é múltiplo de 3
    g.scrollY = stageEndY(4) + 100000; // muito além do fim
    h.step(5);
    expect(h.state()).toBe('playing');
    expect(g.bossTriggered).toBe(false);
  });

  test('chefe não re-dispara após a intro confirmada (bossTriggered)', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    g.stage = 3;
    g.scrollY = stageEndY(3) - 1500 - g.H + 50;
    h.step(3);
    h.game.confirmIntro();
    // avança mais mundo — não deve re-gatilhar com o chefe vivo
    g.scrollY = stageEndY(3) + 5000;
    h.step(10);
    expect(h.state()).toBe('playing');
    expect(g.pendingBoss).toBeNull();
  });
});

describe('Game — roundtrip de missões e checkpoints (Round 2)', () => {
  const RUN_KEY = 'riverraid_remaster_run_v1';

  beforeEach(() => {
    resetStorage();
  });

  test('missões em progresso sobrevivem save → continueRun', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    g.missions.progress('destroy_20', 12);
    g.missions.complete('combo_x3');
    g.missions.markRewarded(
      g.missions.list.find((m) => m.id === 'combo_x3')!
    );
    g.saveCheckpoint();

    const h2 = await createGame();
    h2.game.continueRun();
    const g2 = priv<GamePriv>(h2.game);
    const d20 = g2.missions.list.find((m) => m.id === 'destroy_20')!;
    const c3 = g2.missions.list.find((m) => m.id === 'combo_x3')!;
    expect(d20.progress).toBe(12);
    expect(d20.completed).toBe(false);
    expect(c3.completed).toBe(true);
    expect(c3.rewardGiven).toBe(true); // não re-compensa após continue
  });

  test('progress adulterado acima do objetivo é clampado no restore', async () => {
    setRawStorage(
      RUN_KEY,
      JSON.stringify({
        version: 1,
        seed: 42,
        stage: 2,
        score: 100,
        lives: 3,
        missions: [
          { id: 'destroy_20', progress: 999, completed: false, rewardGiven: false },
        ],
        savedAt: Date.now(),
      })
    );
    const h = await createGame();
    h.game.continueRun();
    const g = priv<GamePriv>(h.game);
    const d20 = g.missions.list.find((m) => m.id === 'destroy_20')!;
    expect(d20.progress).toBe(20); // clampado ao objetivo
    expect(d20.completed).toBe(true);
    // e a recompensa é entregue exatamente uma vez
    const completas = g.missions.popCompleted();
    expect(completas).toHaveLength(1);
    g.missions.markRewarded(completas[0]);
    expect(g.missions.popCompleted()).toHaveLength(0);
  });

  test('checkpoint em fase de chefe re-gatilha o chefe no continue', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    g.stage = 3;
    g.scrollY = stageEndY(3) - 1500 - g.H + 50;
    h.step(3);
    expect(h.state()).toBe('bossIntro');
    // salva DURANTE a intro (saveAndExit via pausa não é possível aqui;
    // checkpoint manual simula o mesmo estado)
    g.saveCheckpoint();

    const h2 = await createGame();
    h2.game.continueRun();
    const g2 = priv<GamePriv>(h2.game);
    expect(h2.state()).toBe('playing');
    // fase 3 restaurada no início → voar até o gatilho re-traz o chefe
    g2.scrollY = stageEndY(3) - 1500 - g2.H + 50;
    h2.step(3);
    expect(h2.state()).toBe('bossIntro');
    expect(g2.pendingBoss!.id).toBe(1);
  });
});

describe('Game — spawns de depósitos sempre no canal (Round 2)', () => {
  beforeEach(() => {
    resetStorage();
  });

  test('depósitos nunca nascem na terra nem na ilha', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    const river = (h.game as unknown as {
      river: {
        shapeAt(wy: number): {
          left: number; right: number;
          islandLeft: number; islandRight: number; hasIsland: boolean;
        };
      };
    }).river;
    for (let i = 0; i < 400; i++) {
      g.updateSpawns(1 / 60);
      g.scrollY += 350;
    }
    let checked = 0;
    for (const d of g.pickups.depots) {
      const s = river.shapeAt(d.worldY);
      const x = d.x / 960;
      expect(x).toBeGreaterThanOrEqual(s.left);
      expect(x).toBeLessThanOrEqual(s.right);
      if (s.hasIsland) {
        expect(x > s.islandLeft && x < s.islandRight).toBe(false);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('Game — simulação extrema (Round 2)', () => {
  beforeEach(() => {
    resetStorage();
  });

  test('6000 frames (~100s) com inimigos: motor estável, fuel nunca NaN', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    let crashes = 0;
    for (let i = 0; i < 6000; i++) {
      g.update(1 / 60);
      if (!g.player.alive) crashes++;
      if (h.state() === 'gameover') {
        h.game.newGame();
        h.game.confirmIntro();
      }
    }
    expect(Number.isFinite(g.fuel)).toBe(true);
    expect(Number.isFinite(g.scrollY)).toBe(true);
    expect(crashes).toBeGreaterThan(0); // o jogo é difícil mesmo :)
  });

  test('dt gigante (debug/aba lenta) não gera NaN no estado', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    g.update(10); // 10s de uma vez (acima do clamp do frame, mas update é público-indireto)
    g.update(100);
    expect(Number.isFinite(g.fuel)).toBe(true);
    expect(Number.isFinite(g.scrollY)).toBe(true);
    expect(Number.isFinite(g.player.x)).toBe(true);
    expect(Number.isFinite(g.player.y)).toBe(true);
  });

  test('muitas mortes seguidas levam ao game over sem estados presos', async () => {
    const h = await createGame();
    h.game.newGame();
    h.game.confirmIntro();
    const g = priv<GamePriv>(h.game);
    let guard = 0;
    while (h.state() !== 'gameover' && guard++ < 5000) {
      if (g.player.alive) g.update(1 / 60); else g.update(1 / 60);
      if (h.state() === 'gameover') break;
      if (g.player.alive) {
        // mata o jogador sempre que possível
        (h.game as unknown as { crash(): void }).crash();
      }
    }
    expect(h.state()).toBe('gameover');
    expect(g.player.alive).toBe(false);
    // HUD final é finito
    const hud = h.lastHud();
    expect(Number.isFinite(hud.score)).toBe(true);
    expect(Number.isFinite(hud.lives)).toBe(true);
  });
});
