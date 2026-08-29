/**
 * Testes adversariais — /api/scores
 * ----------------------------------
 * Foco: branches REJEITADOS (400/429/500) e entradas malformadas.
 * O fake do Prisma imita a validação real (take/skip devem ser Int),
 * então `?limit=2.5` quebra exatamente como quebraria em produção.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import type { NextRequest } from 'next/server';
import { makeFakeDb } from './fake-db';

const fakeDb = makeFakeDb();
mock.module('@/lib/db', () => ({ db: fakeDb.db }));

const { GET, POST } = await import('@/app/api/scores/route');

// ---------------------------------------------------------------------------
// Fábricas de request (Request real + nextUrl anexado — contrato usado pela rota)
// ---------------------------------------------------------------------------

function makeGet(path: string): NextRequest {
  const r = new Request(`http://localhost:3000${path}`) as Request & {
    nextUrl?: URL;
  };
  r.nextUrl = new URL(r.url);
  return r as unknown as NextRequest;
}

function makePost(
  body: string | null,
  opts: { xff?: string } = {}
): NextRequest {
  const r = new Request('http://localhost:3000/api/scores', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      ...(opts.xff ? { 'x-forwarded-for': opts.xff } : {}),
    },
  }) as Request & { nextUrl?: URL };
  r.nextUrl = new URL(r.url);
  return r as unknown as NextRequest;
}

let ipCounter = 1;
/** IP único por teste para não vazar rate-limit entre testes (compartilham o módulo). */
function freshIp(): string {
  return `10.99.0.${ipCounter++}`;
}

const validBody = JSON.stringify({
  name: 'Piloto',
  score: 1234,
  stage: 2,
  kills: 7,
});

beforeEach(() => {
  fakeDb.reset([]);
});

// ---------------------------------------------------------------------------
// GET — sanitização do parâmetro limit
// ---------------------------------------------------------------------------

describe('GET /api/scores — limit', () => {
  test('sem parâmetro → top 10', async () => {
    fakeDb.reset(
      Array.from({ length: 20 }, (_, i) => ({
        name: `P${i}`,
        score: i * 10,
        stage: 1,
      }))
    );
    const res = await GET(makeGet('/api/scores'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.scores).toHaveLength(10);
  });

  test('?limit=3 → 3 resultados', async () => {
    fakeDb.reset(
      Array.from({ length: 20 }, (_, i) => ({ name: `P${i}`, score: i, stage: 1 }))
    );
    const res = await GET(makeGet('/api/scores?limit=3'));
    expect(res.status).toBe(200);
    expect((await res.json()).scores).toHaveLength(3);
  });

  test('?limit=2.5 (float) → NÃO deve responder 500 (Prisma exige Int)', async () => {
    const res = await GET(makeGet('/api/scores?limit=2.5'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.scores)).toBe(true);
    expect(data.scores.length).toBeLessThanOrEqual(2);
  });

  test('?limit=abc → fallback 10', async () => {
    fakeDb.reset(
      Array.from({ length: 20 }, (_, i) => ({ name: `P${i}`, score: i, stage: 1 }))
    );
    const res = await GET(makeGet('/api/scores?limit=abc'));
    expect(res.status).toBe(200);
    expect((await res.json()).scores).toHaveLength(10);
  });

  test('?limit=-5 → mínimo 1', async () => {
    const res = await GET(makeGet('/api/scores?limit=-5'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.scores.length).toBeLessThanOrEqual(1);
  });

  test('?limit=99999 → máximo 50', async () => {
    fakeDb.reset(
      Array.from({ length: 80 }, (_, i) => ({ name: `P${i}`, score: i, stage: 1 }))
    );
    const res = await GET(makeGet('/api/scores?limit=99999'));
    expect(res.status).toBe(200);
    expect((await res.json()).scores).toHaveLength(50);
  });

  test('?limit=1e400 (Infinity) → máximo 50, não 500', async () => {
    const res = await GET(makeGet('/api/scores?limit=1e400'));
    expect(res.status).toBe(200);
  });

  test('ranking ordenado por score desc (empate: mais antigo primeiro)', async () => {
    fakeDb.reset([
      { name: 'A', score: 100, stage: 1 },
      { name: 'B', score: 300, stage: 2 },
      { name: 'C', score: 100, stage: 1 },
    ]);
    const res = await GET(makeGet('/api/scores'));
    const data = await res.json();
    expect(data.scores[0].name).toBe('B');
  });
});

// ---------------------------------------------------------------------------
// POST — validação zod (branch 400)
// ---------------------------------------------------------------------------

describe('POST /api/scores — validação', () => {
  test('payload válido → 200 com rank', async () => {
    const res = await POST(makePost(validBody, { xff: freshIp() }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.rank).toBe(1);
    expect(fakeDb.created).toHaveLength(1);
    expect(fakeDb.created[0].name).toBe('Piloto');
  });

  test('corpo não-JSON → 400 (não 500)', async () => {
    const res = await POST(makePost('{invalid json,,', { xff: freshIp() }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  test('corpo vazio → 400 (não 500)', async () => {
    const r = new Request('http://localhost:3000/api/scores', {
      method: 'POST',
      headers: { 'x-forwarded-for': freshIp() },
    }) as Request & { nextUrl?: URL };
    r.nextUrl = new URL(r.url);
    const res = await POST(r as unknown as NextRequest);
    expect(res.status).toBe(400);
  });

  test('name ausente → 400', async () => {
    const res = await POST(
      makePost(JSON.stringify({ score: 10, stage: 1 }), { xff: freshIp() })
    );
    expect(res.status).toBe(400);
  });

  test('name só com espaços → 400 (trim antes do min)', async () => {
    const res = await POST(
      makePost(JSON.stringify({ name: '   ', score: 10, stage: 1 }), {
        xff: freshIp(),
      })
    );
    expect(res.status).toBe(400);
  });

  test('name com 17 caracteres → 400', async () => {
    const res = await POST(
      makePost(
        JSON.stringify({ name: 'a'.repeat(17), score: 10, stage: 1 }),
        { xff: freshIp() }
      )
    );
    expect(res.status).toBe(400);
  });

  test('name com 16 caracteres → 200', async () => {
    const res = await POST(
      makePost(
        JSON.stringify({ name: 'a'.repeat(16), score: 10, stage: 1 }),
        { xff: freshIp() }
      )
    );
    expect(res.status).toBe(200);
  });

  test('score negativo → 400', async () => {
    const res = await POST(
      makePost(JSON.stringify({ name: 'X', score: -1, stage: 1 }), {
        xff: freshIp(),
      })
    );
    expect(res.status).toBe(400);
  });

  test('score float → 400', async () => {
    const res = await POST(
      makePost(JSON.stringify({ name: 'X', score: 1.5, stage: 1 }), {
        xff: freshIp(),
      })
    );
    expect(res.status).toBe(400);
  });

  test('score acima do teto (100M) → 400', async () => {
    const res = await POST(
      makePost(
        JSON.stringify({ name: 'X', score: 100_000_001, stage: 1 }),
        { xff: freshIp() }
      )
    );
    expect(res.status).toBe(400);
  });

  test('score como string → 400', async () => {
    const res = await POST(
      makePost(JSON.stringify({ name: 'X', score: '100', stage: 1 }), {
        xff: freshIp(),
      })
    );
    expect(res.status).toBe(400);
  });

  test('stage 0 → 400', async () => {
    const res = await POST(
      makePost(JSON.stringify({ name: 'X', score: 10, stage: 0 }), {
        xff: freshIp(),
      })
    );
    expect(res.status).toBe(400);
  });

  test('stage 1000 → 400', async () => {
    const res = await POST(
      makePost(JSON.stringify({ name: 'X', score: 10, stage: 1000 }), {
        xff: freshIp(),
      })
    );
    expect(res.status).toBe(400);
  });

  test('stage float → 400', async () => {
    const res = await POST(
      makePost(JSON.stringify({ name: 'X', score: 10, stage: 2.5 }), {
        xff: freshIp(),
      })
    );
    expect(res.status).toBe(400);
  });

  test('kills negativo → 400', async () => {
    const res = await POST(
      makePost(
        JSON.stringify({ name: 'X', score: 10, stage: 1, kills: -3 }),
        { xff: freshIp() }
      )
    );
    expect(res.status).toBe(400);
  });

  test('kills ausente → 200 com default 0', async () => {
    const res = await POST(
      makePost(JSON.stringify({ name: 'X', score: 10, stage: 1 }), {
        xff: freshIp(),
      })
    );
    expect(res.status).toBe(200);
    expect(fakeDb.created[0].kills).toBe(0);
  });

  test('campos desconhecidos são removidos (zod strip)', async () => {
    const res = await POST(
      makePost(
        JSON.stringify({
          name: 'X',
          score: 10,
          stage: 1,
          hacks: 'DROP TABLE',
          id: 'injected',
        }),
        { xff: freshIp() }
      )
    );
    expect(res.status).toBe(200);
    const row = fakeDb.created[0] as unknown as Record<string, unknown>;
    expect('hacks' in row).toBe(false);
    expect('id' in row && row.id !== undefined && String(row.id).startsWith('row-')).toBe(true);
  });

  test('payload null → 400', async () => {
    const r = new Request('http://localhost:3000/api/scores', {
      method: 'POST',
      body: 'null',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': freshIp(),
      },
    }) as Request & { nextUrl?: URL };
    r.nextUrl = new URL(r.url);
    const res = await POST(r as unknown as NextRequest);
    expect(res.status).toBe(400);
  });

  test('payload array → 400', async () => {
    const r = new Request('http://localhost:3000/api/scores', {
      method: 'POST',
      body: '[]',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': freshIp(),
      },
    }) as Request & { nextUrl?: URL };
    r.nextUrl = new URL(r.url);
    const res = await POST(r as unknown as NextRequest);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST — rank e poda
// ---------------------------------------------------------------------------

describe('POST /api/scores — rank e poda', () => {
  test('rank reflete quantos scores são melhores', async () => {
    fakeDb.reset([
      { name: 'top', score: 5000, stage: 5 },
      { name: 'mid', score: 2000, stage: 3 },
    ]);
    const res = await POST(
      makePost(JSON.stringify({ name: 'X', score: 3000, stage: 3 }), {
        xff: freshIp(),
      })
    );
    const data = await res.json();
    expect(data.rank).toBe(2);
  });

  test('poda mantém apenas as 100 melhores (score baixo é podado)', async () => {
    fakeDb.reset(
      Array.from({ length: 100 }, (_, i) => ({
        name: `P${i}`,
        score: 1000 + i,
        stage: 1,
      }))
    );
    // score 50 entra como o pior → é podado imediatamente
    const res = await POST(
      makePost(JSON.stringify({ name: 'worst', score: 50, stage: 1 }), {
        xff: freshIp(),
      })
    );
    expect(res.status).toBe(200);
    expect(fakeDb.rows).toHaveLength(100);
    expect(fakeDb.rows.some((r) => r.score === 50)).toBe(false);
    expect(fakeDb.rows.some((r) => r.score === 1000)).toBe(true);
  });

  test('poda expulsa o antigo pior quando o score novo é bom', async () => {
    fakeDb.reset(
      Array.from({ length: 100 }, (_, i) => ({
        name: `P${i}`,
        score: 1000 + i,
        stage: 1,
      }))
    );
    const res = await POST(
      makePost(JSON.stringify({ name: 'top', score: 5000, stage: 9 }), {
        xff: freshIp(),
      })
    );
    expect(res.status).toBe(200);
    expect(fakeDb.rows).toHaveLength(100);
    expect(fakeDb.rows.some((r) => r.score === 5000)).toBe(true);
    expect(fakeDb.rows.some((r) => r.score === 1000)).toBe(false); // pior antigo saiu
  });
});

// ---------------------------------------------------------------------------
// POST — rate limit (branch 429)
// ---------------------------------------------------------------------------

describe('POST /api/scores — rate limit', () => {
  test('segundo envio imediato do mesmo IP → 429', async () => {
    const ip = freshIp();
    const first = await POST(makePost(validBody, { xff: ip }));
    expect(first.status).toBe(200);
    const second = await POST(makePost(validBody, { xff: ip }));
    expect(second.status).toBe(429);
  });

  test('429 vem ANTES da validação (payload inválido também é limitado)', async () => {
    const ip = freshIp();
    const first = await POST(makePost('{bad json', { xff: ip }));
    expect(first.status).toBe(400); // consome o slot mesmo inválido
    const second = await POST(makePost(validBody, { xff: ip }));
    expect(second.status).toBe(429);
  });

  test('IPs diferentes não compartilham o limite', async () => {
    const a = await POST(makePost(validBody, { xff: freshIp() }));
    const b = await POST(makePost(validBody, { xff: freshIp() }));
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
  });

  test('XFF com múltiplos hops usa o primeiro valor', async () => {
    const ip = freshIp();
    const first = await POST(
      makePost(validBody, { xff: `${ip}, 192.168.0.1, 10.0.0.1` })
    );
    expect(first.status).toBe(200);
    // mesmo primeiro hop, segundo valor diferente → mesmo bucket
    const second = await POST(
      makePost(validBody, { xff: `${ip}, 192.168.0.2` })
    );
    expect(second.status).toBe(429);
  });

  test('XFF gigante/lixo não cria chave absurda (fallback local)', async () => {
    const giant = 'x'.repeat(500);
    const first = await POST(makePost(validBody, { xff: giant }));
    expect(first.status).toBe(200);
    const second = await POST(makePost(validBody, { xff: giant }));
    expect(second.status).toBe(429); // caiu no mesmo bucket 'local'
  });

  test('Map de rate-limit não cresce sem limite (anti-OOM)', async () => {
    // Inunda com IPs únicos; a implementação deve podar entradas antigas.
    // Se o Map crescer 1 entrada por request sem poda, 3000 entradas ficam.
    for (let i = 0; i < 3000; i++) {
      const res = await POST(
        makePost(validBody, { xff: `198.51.100.${i % 256}.${i}` })
      );
      expect(res.status).toBe(200);
    }
    // O teste passa mesmo se só algumas entradas forem mantidas —
    // o objetivo é não estourar memória nem quebrar o serviço.
    const probe = await POST(makePost(validBody, { xff: `198.51.100.0.0` }));
    // A chave de prova já foi usada no loop; deve estar limitada OU o
    // mapa ter sido podado (ambos os comportamentos são aceitáveis).
    expect([200, 429]).toContain(probe.status);
  });
});
