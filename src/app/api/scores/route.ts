import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

/**
 * Ranking global do River Raid Remaster.
 * GET  /api/scores        → top 10
 * POST /api/scores        → registra pontuação e devolve a posição
 *
 * Implementa o "sistema de ranking global" pedido na especificação (PDF),
 * que não existia no código original.
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

// Rate-limit simples em memória (por IP): 1 envio a cada 5 s
const lastSubmit = new Map<string, number>();

export async function GET(req: NextRequest) {
  try {
    const limitParam = req.nextUrl.searchParams.get('limit');
    const limit = Math.min(Math.max(Number(limitParam) || 10, 1), 50);
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
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    const now = Date.now();
    const last = lastSubmit.get(ip) ?? 0;
    if (now - last < 5000) {
      return NextResponse.json(
        { error: 'Aguarde alguns segundos antes de enviar novamente.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = scoreSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, score, stage, kills } = parsed.data;
    await db.score.create({ data: { name, score, stage, kills } });
    lastSubmit.set(ip, now);

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
