/**
 * Fake do Prisma (db.score.*) — imita validações relevantes do Prisma
 * (ex.: `take` DEVE ser Int) para que os testes peguem regressões reais.
 * Separado dos stubs de browser para não interferir no next/server.
 */

// ---------------------------------------------------------------------------
// Fake do Prisma (db.score.*) — imita validações relevantes do Prisma
// (ex.: `take` DEVE ser Int) para que os testes peguem regressões reais.
// ---------------------------------------------------------------------------

export interface FakeScoreRow {
  id: string;
  name: string;
  score: number;
  stage: number;
  kills: number;
  createdAt: Date;
}

export interface FakeDbState {
  db: {
    score: {
      findMany(args: any): Promise<any[]>;
      create(args: any): Promise<any>;
      count(args?: any): Promise<number>;
      deleteMany(args: any): Promise<{ count: number }>;
    };
  };
  rows: FakeScoreRow[];
  reset(seed?: Array<{ name: string; score: number; stage: number; kills?: number }>): void;
  created: FakeScoreRow[];
}

export function makeFakeDb(
  seed: Array<{ name: string; score: number; stage: number; kills?: number }> = []
): FakeDbState {
  const state: FakeDbState = {
    rows: [],
    created: [],
    reset(next = []) {
      state.rows = next.map((r, i) => ({
        id: `seed-${i}`,
        name: r.name,
        score: r.score,
        stage: r.stage,
        kills: r.kills ?? 0,
        createdAt: new Date(2026, 0, 1, 0, 0, 0, i),
      }));
      state.created = [];
    },
    db: {
      score: {
        async findMany(args: any) {
          // Validação que o Prisma real faz: take/skip devem ser Int
          for (const field of ['take', 'skip']) {
            const v = args?.[field];
            if (v !== undefined && !Number.isInteger(v)) {
              throw new Error(
                `Provided ${typeof v === 'number' && !Number.isInteger(v) ? 'Float' : typeof v} ${field} value is not an Int`
              );
            }
          }
          const rows = [...state.rows];
          const orderBy = args?.orderBy ?? [];
          const first = orderBy[0];
          if (first && 'score' in first) {
            rows.sort((a, b) =>
              first.score === 'desc' ? b.score - a.score : a.score - b.score
            );
          }
          if (orderBy.length > 1 && 'createdAt' in orderBy[1]) {
            const dir = orderBy[1].createdAt === 'desc' ? -1 : 1;
            // desempate estável
            rows.sort((a, b) =>
              a.score === b.score ? (a.createdAt.getTime() - b.createdAt.getTime()) * dir : 0
            );
          }
          let out = rows;
          if (args?.where?.id?.in) {
            const ids = new Set<string>(args.where.id.in);
            out = out.filter((r) => ids.has(r.id));
          }
          if (args?.take !== undefined) out = out.slice(0, args.take);
          if (args?.select) {
            out = out.map((r) => {
              const o: Record<string, unknown> = {};
              for (const k of Object.keys(args.select)) o[k] = (r as any)[k];
              return o;
            });
          }
          return out;
        },
        async create(args: any) {
          const row: FakeScoreRow = {
            id: `row-${state.rows.length}-${Date.now()}`,
            name: args.data.name,
            score: args.data.score,
            stage: args.data.stage,
            kills: args.data.kills ?? 0,
            createdAt: new Date(),
          };
          state.rows.push(row);
          state.created.push(row);
          return row;
        },
        async count(args?: any) {
          if (args?.where?.score?.gt !== undefined) {
            return state.rows.filter((r) => r.score > args.where.score.gt).length;
          }
          return state.rows.length;
        },
        async deleteMany(args: any) {
          const ids = new Set<string>(args?.where?.id?.in ?? []);
          const before = state.rows.length;
          state.rows = state.rows.filter((r) => !ids.has(r.id));
          return { count: before - state.rows.length };
        },
      },
    },
  };
  state.reset(seed);
  return state;
}
