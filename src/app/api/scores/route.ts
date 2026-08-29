import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { RateLimiter, sanitizeLimit, clientIpFrom } from '@/lib/api-helpers';

/**
 * Ranking global do River Raid Remaster.
 * GET  /api/scores        → top N (limit 1..50, sanitizado)
 * POST /api/scores        → registra pontuação e devolve a posição
 *
 * Implementa o "sistema de ranking global" pedido na especificação (PDF),
 * que não existia no código original.
 *
 * Endurecimento (revisão adversarial):
 *  - `limit` não-inteiro (ex.: ?limit=2.5) era repassado ao Prisma e
 *    derrubava a rota com 500 → agora é truncado antes da consulta;
 *  - corpo não-JSON devolvia 500 (erro de servidor) → agora 400;
 *  - o rate-limit consome o slot em TODA tentativa, inclusive inválida
 *    (spam de payloads lixos também é travado);
 *  - o mapa do rate-limit poda entradas antigas e se reinicia sob
 *    inundação de IPs forjados via `x-forwarded-for` (anti-OOM).
 */

const MAX_SCORES = 100;

const scoreSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nome obrigatório')
    .max(16, 'Nome muito longo'),
  score: z.number().int().min(0).max(100_000_000),
  stage: z.number().int().min(1).max(999),
  kills: z.number().int().min(0).max(100_000).default(0),
});

// Rate-limit em memória (por IP): 1 envio a cada 5 s
const rateLimiter = new RateLimiter(5000, 1024);

export async function GET(req: NextRequest) {
  try {
    const limit = sanitizeLimit(req.nextUrl.searchParams.get('limit'));
    const scores = await db.score.findMany({
      orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
      take: limit,
      select: {
        id: true,
        name: true,
        score: true,
        stage: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ scores });
  } catch (error) {
    console.error('GET /api/scores falhou:', error);
    return NextResponse.json(
      { error: 'Falha ao carregar o ranking.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const ip = clientIpFrom(req.headers.get('x-forwarded-for'));
  const now = Date.now();
  if (!rateLimiter.tryAcquire(ip, now)) {
    return NextResponse.json(
      { error: 'Aguarde alguns segundos antes de enviar novamente.' },
      { status: 429 }
    );
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      // JSON malformado é erro do cliente, não do servidor
      return NextResponse.json(
        { error: 'Corpo da requisição deve ser JSON válido.' },
        { status: 400 }
      );
    }

    const parsed = scoreSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, score, stage, kills } = parsed.data;
    await db.score.create({ data: { name, score, stage, kills } });

    // Poda: mantém apenas as MAX_SCORES melhores
    const total = await db.score.count();
    if (total > MAX_SCORES) {
      const worst = await db.score.findMany({
        orderBy: [{ score: 'asc' }, { createdAt: 'desc' }],
        take: total - MAX_SCORES,
        select: { id: true },
      });
      await db.score.deleteMany({
        where: { id: { in: worst.map((w) => w.id) } },
      });
    }

    const better = await db.score.count({ where: { score: { gt: score } } });
    const rank = better + 1;

    return NextResponse.json({ ok: true, rank });
  } catch (error) {
    console.error('POST /api/scores falhou:', error);
    return NextResponse.json(
      { error: 'Falha ao registrar a pontuação.' },
      { status: 500 }
    );
  }
}
