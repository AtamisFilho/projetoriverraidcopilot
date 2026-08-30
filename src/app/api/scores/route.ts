import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const scores = await db.score.findMany({
      orderBy: { score: "desc" },
      take: 10,
    });
    return NextResponse.json({ scores });
  } catch {
    return NextResponse.json({ scores: [] });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: unknown;
      score?: unknown;
      distance?: unknown;
      chapter?: unknown;
      enemies?: unknown;
    };

    // Validação rigorosa (branch de rejeição)
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
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
}
