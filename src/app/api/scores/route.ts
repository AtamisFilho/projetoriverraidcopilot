import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RateLimiter, sanitizeLimit, clientIpFrom } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/**
 * Ranking global.
 * GET  /api/scores        → top N (limit 1..50, sanitizado)
 * POST /api/scores        → registra pontuação
 *
 * Endurecimento (revisão adversarial, portado do commit 3fbfe85):
 *  - `limit` não-inteiro (ex.: ?limit=2.5) era repassado ao Prisma e
 *    derrubava a rota com 500 → agora é sanitizado antes da consulta;
 *  - rate-limit por IP (1 envio / 5 s) que consome o slot em TODA
 *    tentativa, inclusive inválida (spam de payload lixo também é
 *    travado), com poda e reinício do mapa sob inundação (anti-OOM).
 */

const rateLimiter = new RateLimiter(5000, 1024);

export async function GET(req: NextRequest) {
  try {
    const limit = sanitizeLimit(req.nextUrl.searchParams.get("limit"));
    const scores = await db.score.findMany({
      orderBy: [{ score: "desc" }, { createdAt: "asc" }],
      take: limit,
      select: {
        id: true,
        name: true,
        score: true,
        distance: true,
        chapter: true,
        enemies: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ scores });
  } catch {
    return NextResponse.json({ scores: [] });
  }
}

export async function POST(req: Request) {
  // Rate-limit antes da validação: o slot é consumido em toda tentativa
  const ip = clientIpFrom(req.headers.get("x-forwarded-for"));
  if (!rateLimiter.tryAcquire(ip)) {
    return NextResponse.json(
      { error: "Aguarde alguns segundos antes de enviar novamente." },
      { status: 429, headers: { "Retry-After": "5" } }
    );
  }

  try {
    const body = (await req.json()) as {
      name?: unknown;
      score?: unknown;
      distance?: unknown;
      chapter?: unknown;
      enemies?: unknown;
    };

    // Validação rigorosa (branches de rejeição)
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 12) : "";
    const score = Number(body.score);
    const distance = Number(body.distance);
    const chapter = Number(body.chapter);
    const enemies = Number(body.enemies);

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: "Nome inválido: informe ao menos 2 caracteres." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(score) || score < 0 || score > 100_000_000) {
      return NextResponse.json({ error: "Pontuação inválida." }, { status: 400 });
    }
    if (!Number.isFinite(distance) || distance < 0 || distance > 10_000_000) {
      return NextResponse.json({ error: "Distância inválida." }, { status: 400 });
    }
    const safeChapter = Number.isFinite(chapter) ? Math.min(Math.max(Math.trunc(chapter), 1), 99) : 1;
    const safeEnemies = Number.isFinite(enemies) ? Math.min(Math.max(Math.trunc(enemies), 0), 1_000_000) : 0;

    const created = await db.score.create({
      data: {
        name,
        score: Math.trunc(score),
        distance: Math.trunc(distance),
        chapter: safeChapter,
        enemies: safeEnemies,
      },
    });
    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/scores]", err);
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
}
