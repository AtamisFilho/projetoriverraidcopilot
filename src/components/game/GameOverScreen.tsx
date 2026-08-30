"use client";

import { useState } from "react";
import { ArrowRight, Home, Medal, Plane, RotateCcw, Send, Skull, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RankingPanel } from "./RankingPanel";
import type { RunResult } from "@/lib/game/types";

/* =========================================================================
 * FIM DE JOGO — estatísticas da partida + envio ao ranking global.
 * ========================================================================= */

export function GameOverScreen({
  result,
  onRestart,
  onMenu,
}: {
  result: RunResult;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const submit = async () => {
    const trimmed = name.trim().slice(0, 12);
    if (!trimmed || sending || sent) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          score: result.score,
          distance: result.distanceM,
          chapter: result.chapter,
          enemies: result.enemiesKilled,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Falha ao enviar pontuação.");
      }
      setSent(true);
      setRefreshKey((k) => k + 1);
    } catch {
      const apk =
        typeof window !== "undefined" && !window.location.protocol.startsWith("http");
      setError(
        apk
          ? "No aplicativo Android o jogo é 100% offline — o ranking global fica disponível na versão web."
          : "Falha ao enviar pontuação (verifique sua conexão)."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-dvh w-full bg-background overflow-y-auto nice-scroll">
      <main className="max-w-2xl mx-auto px-4 py-10 flex flex-col items-center gap-6">
        {/* Cabeçalho */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1 text-[11px] font-black tracking-widest text-red-400 mb-3">
            <Skull className="size-3.5" aria-hidden />
            MISSÃO ENCERRADA
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-foreground">FIM DE JOGO</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Sua aeronave foi perdida no rio. Todo progresso da missão foi registrado.
          </p>
        </div>

        {/* Pontuação gigante */}
        <div className="rounded-2xl border-2 border-primary/50 bg-card/70 backdrop-blur px-10 py-6 text-center shadow-[0_0_40px_rgba(52,211,153,0.15)]">
          <div className="text-[10px] font-black tracking-widest text-muted-foreground">
            PONTUAÇÃO FINAL
          </div>
          <div className="text-5xl font-black tabular-nums text-primary leading-tight">
            {result.score.toLocaleString("pt-BR")}
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
          <Stat icon={<Plane className="size-4" aria-hidden />} label="DISTÂNCIA" value={`${result.distanceM.toLocaleString("pt-BR")} m`} />
          <Stat icon={<Medal className="size-4" aria-hidden />} label="CAPÍTULO" value={`${result.chapter} / 3`} />
          <Stat icon={<Skull className="size-4" aria-hidden />} label="ABATES" value={`${result.enemiesKilled}`} />
          <Stat icon={<Trophy className="size-4" aria-hidden />} label="BARRIS" value={`${result.fuelCollected}`} />
        </div>

        {/* Envio ao ranking */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="size-4 text-amber-400" aria-hidden />
              REGISTRAR NO RANKING GLOBAL
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="flex items-center gap-2 rounded-lg border border-green-700/50 bg-green-950/40 px-4 py-3">
                <Badge variant="default">✓ ENVIADO</Badge>
                <span className="text-sm text-green-300 font-bold">
                  Pontuação registrada com sucesso, piloto {name.trim()}!
                </span>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void submit()}
                  placeholder="Nome do piloto (máx. 12)"
                  maxLength={12}
                  disabled={sending}
                  aria-label="Nome do piloto para o ranking"
                />
                <Button onClick={() => void submit()} disabled={!name.trim() || sending} className="sm:w-40">
                  {sending ? (
                    "ENVIANDO…"
                  ) : (
                    <>
                      <Send className="size-4" aria-hidden />
                      ENVIAR
                    </>
                  )}
                </Button>
              </div>
            )}
            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          </CardContent>
        </Card>

        {/* Ranking */}
        <div className="w-full">
          <RankingPanel refreshKey={refreshKey} />
        </div>

        {/* Ações */}
        <div className="flex flex-col sm:flex-row gap-3 w-full pb-8">
          <Button size="lg" onClick={onRestart} className="flex-1 shadow-lg">
            <RotateCcw className="size-4" aria-hidden />
            JOGAR NOVAMENTE
          </Button>
          <Button size="lg" variant="outline" onClick={onMenu} className="flex-1">
            <Home className="size-4" aria-hidden />
            MENU PRINCIPAL
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground flex items-center gap-1 pb-6">
          Dica: estude o briefing no menu para dominar cada inimigo
          <ArrowRight className="size-3" aria-hidden />
        </p>
      </main>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/60 backdrop-blur px-3 py-3 text-center">
      <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[9px] font-black tracking-widest">{label}</span>
      </div>
      <div className="text-lg font-black tabular-nums text-foreground mt-1">{value}</div>
    </div>
  );
}
