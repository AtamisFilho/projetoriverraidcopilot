'use client';

/**
 * Ranking: global (API + Prisma/SQLite) e local (localStorage),
 * conforme a especificação do PDF ("sistema de ranking global e local").
 */

import { useCallback, useEffect, useState } from 'react';
import { Globe, MapPin, RefreshCw, Trophy } from 'lucide-react';
import type { ScoreEntry } from '@/game/types';
import { formatScore } from '@/game/utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

interface GlobalScore {
  id: string;
  name: string;
  score: number;
  stage: number;
  createdAt: string;
}

export function Leaderboard({
  localScores,
  highlightScore,
  onSubmissionDone,
}: {
  localScores: ScoreEntry[];
  highlightScore?: number | null;
  onSubmissionDone?: () => void;
}) {
  const [tab, setTab] = useState<'global' | 'local'>('global');
  const [global, setGlobal] = useState<GlobalScore[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/scores?limit=10', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { scores: GlobalScore[] };
      setGlobal(data.scores);
    } catch {
      setError('Não foi possível carregar o ranking global.');
    } finally {
      setLoading(false);
      onSubmissionDone?.();
    }
  }, []);

  useEffect(() => {
    if (tab === 'global' && global === null && !loading && !error) void load();
  }, [tab, global, loading, error, load]);

  return (
    <div className="w-full">
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'global' | 'local')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="global" className="gap-1.5">
            <Globe className="size-3.5" /> Global
          </TabsTrigger>
          <TabsTrigger value="local" className="gap-1.5">
            <MapPin className="size-3.5" /> Local
          </TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="mt-3">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
              <RefreshCw className="size-4 animate-spin" /> Carregando…
            </div>
          )}
          {error && !loading && (
            <div className="space-y-3 py-4 text-center">
              <p className="text-sm text-red-300">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void load()}>
                <RefreshCw className="mr-2 size-3.5" /> Tentar novamente
              </Button>
            </div>
          )}
          {!error && !loading && global !== null && (
            <ScoreTable
              rows={global.map((s) => ({
                name: s.name,
                score: s.score,
                stage: s.stage,
                date: s.createdAt,
              }))}
              highlightScore={highlightScore}
            />
          )}
          {!error && !loading && global !== null && global.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">
              Nenhuma pontuação registrada ainda. Seja o primeiro!
            </p>
          )}
        </TabsContent>

        <TabsContent value="local" className="mt-3">
          {localScores.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Nenhuma partida local ainda.
            </p>
          ) : (
            <ScoreTable rows={localScores} highlightScore={highlightScore} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScoreTable({
  rows,
  highlightScore,
}: {
  rows: { name: string; score: number; stage: number; date: string }[];
  highlightScore?: number | null;
}) {
  return (
    <ol className="space-y-1.5">
      {rows.map((row, i) => {
        const isHighlight =
          highlightScore != null && row.score === highlightScore;
        return (
          <li
            key={`${row.name}-${row.score}-${i}`}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm',
              isHighlight
                ? 'border-amber-400/60 bg-amber-500/15'
                : 'border-white/10 bg-white/5'
            )}
          >
            <span
              className={cn(
                'grid size-7 shrink-0 place-items-center rounded-full font-mono text-xs font-bold',
                i === 0
                  ? 'bg-amber-500/25 text-amber-300'
                  : i === 1
                    ? 'bg-slate-400/20 text-slate-200'
                    : i === 2
                      ? 'bg-orange-700/30 text-orange-300'
                      : 'bg-white/5 text-slate-400'
              )}
            >
              {i < 3 ? <Trophy className="size-3.5" /> : i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-slate-100">
              {row.name}
            </span>
            <span className="shrink-0 text-[11px] text-slate-400">
              Fase {row.stage}
            </span>
            <span className="shrink-0 font-mono font-bold tabular-nums text-teal-300">
              {formatScore(row.score)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
