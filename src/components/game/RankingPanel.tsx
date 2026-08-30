"use client";

import { useEffect, useState } from "react";
import { Trophy, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ScoreRow {
  id: number;
  name: string;
  score: number;
  distance: number;
  chapter: number;
  enemies: number;
  createdAt: string;
}

export function RankingPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scores", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { scores: ScoreRow[] };
      setRows(json.scores);
    } catch {
      setError("Não foi possível carregar o ranking.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/scores", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as { scores: ScoreRow[] };
        if (alive) setRows(json.scores);
      } catch {
        if (alive) setError("Não foi possível carregar o ranking.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  return (
    <Card id="ranking" className="max-w-2xl mx-auto">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="size-5 text-amber-400" aria-hidden />
          RANKING GLOBAL
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={() => void load()} aria-label="Atualizar ranking">
          <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
        </Button>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-red-400 text-center py-6">{error}</p>}
        {!error && rows === null && (
          <div className="space-y-2 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-11 rounded-lg bg-secondary/50 animate-pulse" />
            ))}
          </div>
        )}
        {rows && rows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma pontuação registrada ainda. Seja o primeiro piloto do ranking!
          </p>
        )}
        {rows && rows.length > 0 && (
          <ol className="space-y-1.5 max-h-96 overflow-y-auto nice-scroll pr-1">
            {rows.map((r, i) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/30 px-3 py-2"
              >
                <span
                  className={
                    "w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-black " +
                    (i === 0
                      ? "bg-amber-400/25 text-amber-300"
                      : i === 1
                        ? "bg-slate-300/20 text-slate-200"
                        : i === 2
                          ? "bg-orange-500/20 text-orange-300"
                          : "bg-secondary text-muted-foreground")
                  }
                  aria-label={`${i + 1}º lugar`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-black text-sm text-foreground truncate">{r.name}</div>
                  <div className="text-[11px] text-muted-foreground font-semibold tabular-nums">
                    {r.distance.toLocaleString("pt-BR")} m · cap. {r.chapter} · {r.enemies} abates
                  </div>
                </div>
                <span className="font-black tabular-nums text-primary">
                  {r.score.toLocaleString("pt-BR")}
                </span>
                {i === 0 && <Badge variant="warning">CAMPEÃO</Badge>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
