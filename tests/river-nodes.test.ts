/**
 * Round 3 — regressão do bug crítico de duplicação de nós do rio
 * ----------------------------------------------------------------
 * O `ensure()` regredia `lastNodeY` após pushLakeRun/pushIslandRun,
 * regerando nós por cima dos trechos de lago/ilha. Nós duplicados e
 * fora de ordem quebravam a busca binária do nodeIndexAt → shapeAt
 * instável para o MESMO worldY → spawns fora do rio e rio "pulsando"
 * entre frames. Bug presente desde o primeiro commit, invisível à
 * revisão manual — detectado pelos testes exaustivos do Round 2.
 */

import { describe, test, expect } from 'bun:test';
import { River } from '@/game/world/river';

describe('River — invariantes estruturais dos nós (bug crítico)', () => {
  test('nós têm Y estritamente crescente (sem duplicatas) em 30 seeds', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const r = new River(seed, 0);
      r.ensure(60000);
      const nodes = (r as unknown as { nodes: { y: number }[] }).nodes;
      for (let i = 1; i < nodes.length; i++) {
        expect(nodes[i].y).toBeGreaterThan(nodes[i - 1].y);
      }
    }
  });

  test('shapeAt é ESTÁVEL para o mesmo worldY, independente da ordem das chamadas', () => {
    // padrões de chamada diferentes NÃO podem alterar o rio:
    // a geração é monótona; shapeAt nunca "re-escreve" o passado
    const patterns: Array<(r: River) => void> = [
      (r) => r.ensure(50000), // tudo de uma vez
      (r) => {
        for (let y = 0; y < 50000; y += 420) r.shapeAt(y); // sequencial
      },
      (r) => {
        // saltos aleatórios para frente e consultas para trás
        let y = 0;
        let seed = 12345;
        const rnd = () => {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          return seed / 0x7fffffff;
        };
        while (y < 50000) {
          r.shapeAt(y);
          if (rnd() < 0.3) r.shapeAt(Math.max(0, y - 5000)); // consulta antiga
          y += 500 + Math.floor(rnd() * 2000);
        }
        r.ensure(50000);
      },
    ];

    const reference = new River(777, 0);
    patterns[0](reference);
    for (const apply of patterns) {
      const r = new River(777, 0);
      apply(r);
      r.ensure(50000);
      for (let y = 3000; y < 48000; y += 371) {
        expect(r.shapeAt(y)).toEqual(reference.shapeAt(y));
      }
    }
  });

  test('geração incremental em passos arbitrários é idêntica à geração única', () => {
    const reference = new River(42, 0);
    reference.ensure(40000);
    const stepwise = new River(42, 0);
    for (let y = 2600; y <= 40000; y += 1300) {
      stepwise.ensure(y);
    }
    stepwise.ensure(40000);
    for (let y = 0; y < 40000; y += 211) {
      expect(stepwise.shapeAt(y)).toEqual(reference.shapeAt(y));
    }
  });

  test('nenhum nó é gerado além do teto defensivo', () => {
    const r = new River(1, 0);
    r.ensure(Number.MAX_SAFE_INTEGER);
    const nodes = (r as unknown as { nodes: { y: number }[] }).nodes;
    const maxY = nodes[nodes.length - 1].y;
    // stageStartY(1000) ≈ 255,8 M px
    expect(maxY).toBeLessThanOrEqual(256_000_000);
    // e a busca continua funcional
    const s = r.shapeAt(1e15);
    expect(s.left).toBeLessThan(s.right);
  });
});
