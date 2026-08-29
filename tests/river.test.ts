/**
 * Testes adversariais — Rio procedural
 * Foco: invariantes de forma, canais navegáveis com ilha,
 * spawn seguro e proteção contra worldY patológico.
 */

import { describe, test, expect } from 'bun:test';
import { River } from '@/game/world/river';
import { stageStartY } from '@/game/systems/stages';

describe('River — forma', () => {
  test('shapeAt é determinístico por seed', () => {
    const a = new River(1234, 0);
    const b = new River(1234, 0);
    for (const y of [0, 500, 5000, 20000, 60000]) {
      expect(a.shapeAt(y)).toEqual(b.shapeAt(y));
    }
  });

  test('seeds diferentes geram rios diferentes', () => {
    const a = new River(1, 0);
    const b = new River(2, 0);
    let diff = 0;
    for (let y = 2000; y < 20000; y += 500) {
      if (Math.abs(a.shapeAt(y).left - b.shapeAt(y).left) > 0.001) diff++;
    }
    expect(diff).toBeGreaterThan(3);
  });

  test('limites sempre dentro de [0,1] e left < right', () => {
    const r = new River(99, 0);
    r.ensure(30000);
    for (let y = 0; y < 30000; y += 137) {
      const s = r.shapeAt(y);
      expect(s.left).toBeGreaterThanOrEqual(0);
      expect(s.right).toBeLessThanOrEqual(1);
      expect(s.left).toBeLessThan(s.right);
      // rio navegável: nunca absurdamente estreito
      expect(s.right - s.left).toBeGreaterThan(0.3);
    }
  });

  test('quando há ilha, os dois canais são navegáveis', () => {
    const r = new River(99, 0);
    r.ensure(60000);
    let islands = 0;
    for (let y = 0; y < 60000; y += 97) {
      const s = r.shapeAt(y);
      if (!s.hasIsland) continue;
      islands++;
      const leftChannel = s.islandLeft - s.left;
      const rightChannel = s.right - s.islandRight;
      expect(leftChannel).toBeGreaterThan(0.1);
      expect(rightChannel).toBeGreaterThan(0.1);
      expect(s.islandLeft).toBeLessThan(s.islandRight);
    }
    // com 60k px de mundo e seeds variadas deve haver ilhas
    expect(islands).toBeGreaterThan(0);
  });

  test('ilhas existem em algum seed (cobertura real do recurso)', () => {
    // procura um seed com ilhas nas primeiras 30k px
    let found = false;
    for (let seed = 1; seed < 40 && !found; seed++) {
      const r = new River(seed, 0);
      r.ensure(30000);
      for (let y = 3000; y < 30000; y += 50) {
        if (r.shapeAt(y).hasIsland) {
          found = true;
          break;
        }
      }
    }
    expect(found).toBe(true);
  });

  test('lagos existem em algum seed (cobertura real do recurso)', () => {
    let found = false;
    for (let seed = 1; seed < 60 && !found; seed++) {
      const r = new River(seed, 0);
      r.ensure(60000);
      for (let y = 5000; y < 60000; y += 200) {
        if (r.shapeAt(y).isLake) {
          found = true;
          break;
        }
      }
    }
    expect(found).toBe(true);
  });
});

describe('River — spawnXAt (posição segura)', () => {
  test('nunca devolve posição fora do canal nem dentro da ilha', () => {
    const rngStub = (() => 0.5) as () => number; // determinístico
    for (let seed = 1; seed <= 25; seed++) {
      const r = new River(seed, 0);
      r.ensure(40000);
      for (let y = 1000; y < 40000; y += 331) {
        const margin = 0.05;
        const s = r.shapeAt(y);
        const x = r.spawnXAt(y, margin, rngStub);
        expect(x).toBeGreaterThanOrEqual(s.left + margin - 1e-9);
        expect(x).toBeLessThanOrEqual(s.right - margin + 1e-9);
        if (s.hasIsland) {
          const insideIsland = x > s.islandLeft && x < s.islandRight;
          expect(insideIsland).toBe(false);
        }
      }
    }
  });

  test('com ilha e rng extrema (0 e ~1) continua no canal', () => {
    const r0 = new River(3, 0);
    r0.ensure(30000);
    // encontra um worldY com ilha
    let wy = -1;
    for (let y = 3000; y < 30000; y += 20) {
      if (r0.shapeAt(y).hasIsland) {
        wy = y;
        break;
      }
    }
    if (wy > 0) {
      const s = r0.shapeAt(wy);
      // rng() no contrato [0,1): 0 e o valor mais próximo de 1
      const lo = r0.spawnXAt(wy, 0.05, () => 0);
      const hi = r0.spawnXAt(wy, 0.05, () => 0.999999);
      for (const x of [lo, hi]) {
        const inLeft = x >= s.left && x <= s.islandLeft;
        const inRight = x >= s.islandRight && x <= s.right;
        expect(inLeft || inRight).toBe(true);
      }
    }
  });
});

describe('River — robustez contra worldY patológico', () => {
  test('shapeAt com worldY gigante não trava (cap defensivo no stageAt)', () => {
    const r = new River(1, 0);
    const t0 = Date.now();
    // worldY de uma fase hipotética 1e12 — deve responder rápido,
    // não fazer loop de trilhões de iterações.
    const s = r.shapeAt(1e12);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(2000);
    expect(s.left).toBeLessThan(s.right);
  }, 10000);

  test('decorsFor com faixa negativa não trava', () => {
    const r = new River(1, 0);
    const t0 = Date.now();
    const d = r.decorsFor(-5000, 1000);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(Array.isArray(d)).toBe(true);
    for (const item of d) {
      expect(item.x).toBeGreaterThanOrEqual(0);
      expect(item.x).toBeLessThanOrEqual(1);
    }
  }, 10000);

  test('stageAt via ensure cobre o início de fase 2+ (zonas calmas)', () => {
    // fases posteriores têm início reto/largo (calm zones)
    const r = new River(5, 0);
    r.ensure(stageStartY(5) + 5000);
    const s = r.shapeAt(stageStartY(5) + 100);
    expect(s.right - s.left).toBeGreaterThanOrEqual(0.6); // largo no início
  });
});
