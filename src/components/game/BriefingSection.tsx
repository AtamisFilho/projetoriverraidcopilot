"use client";

import { useState } from "react";
import { Skull, TriangleAlert, Sparkles, Crown, Info } from "lucide-react";
import {
  ENEMY_INFO,
  OBSTACLE_INFO,
  ITEM_INFO,
  BOSS_INFO,
  type EnemyInfo,
  type ObstacleInfo,
  type ItemInfo,
} from "@/lib/game/content";
import { SpritePreview } from "./SpritePreview";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* =========================================================================
 * BRIEFING TÁTICO — apresentação na tela inicial:
 * aeronaves inimigas + características, obstáculos (malefícios) e
 * itens (benefícios). Os previews são os sprites reais do jogo.
 * ========================================================================= */

type Tab = "inimigos" | "obstaculos" | "itens";

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: "inimigos", label: "INIMIGOS", icon: <Skull className="size-4" aria-hidden /> },
  { id: "obstaculos", label: "OBSTÁCULOS", icon: <TriangleAlert className="size-4" aria-hidden /> },
  { id: "itens", label: "ITENS", icon: <Sparkles className="size-4" aria-hidden /> },
];

export function BriefingSection() {
  const [tab, setTab] = useState<Tab>("inimigos");

  return (
    <section id="briefing" className="w-full max-w-4xl mx-auto px-4 py-10" aria-label="Briefing tático">
      {/* Cabeçalho */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1 text-xs font-black tracking-widest text-primary mb-3">
          <Info className="size-3.5" aria-hidden />
          BRIEFING TÁTICO
        </div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
          Conheça o inimigo antes de decolar
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
          Cada aeronave, obstáculo e item do rio catalogado com comportamento, nível de perigo e
          recompensa. Os desenhos abaixo são os <strong className="text-foreground/90">sprites reais</strong> que
          você encontrará em jogo.
        </p>
      </div>

      {/* Abas */}
      <div role="tablist" aria-label="Categorias do briefing" className="flex justify-center mb-8">
        <div className="inline-flex rounded-xl bg-secondary/50 border border-border/60 p-1 backdrop-blur gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-black tracking-wide transition-all cursor-pointer",
                tab === t.id
                  ? "bg-card text-primary shadow-md border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      {tab === "inimigos" && (
        <div className="space-y-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.values(ENEMY_INFO).map((e) => (
              <EnemyCard key={e.id} info={e} />
            ))}
          </div>

          {/* Chefes */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Crown className="size-5 text-amber-400" aria-hidden />
              <h3 className="text-lg font-black text-foreground">GUARDIÕES DE CAPÍTULO</h3>
              <span className="text-xs font-bold text-muted-foreground">
                — derrote para avançar
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {Object.values(BOSS_INFO).map((b) => (
                <div
                  key={b.id}
                  className="group rounded-xl border border-border/70 bg-card/60 backdrop-blur p-4 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <SpritePreview id={b.id} size={96} zoom={0.8} />
                    <div className="min-w-0 flex-1">
                      <Badge variant="warning" className="mb-1">
                        CHEFE · {b.points.toLocaleString("pt-BR")} PTS
                      </Badge>
                      <h4 className="font-black text-foreground leading-tight">{b.name}</h4>
                      <p className="text-[11px] font-bold text-amber-400/90 mt-0.5">{b.tagline}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{b.description}</p>
                  <div className="mt-2.5 rounded-lg bg-secondary/50 px-3 py-2">
                    <div className="text-[9px] font-black tracking-widest text-muted-foreground mb-0.5">
                      PADRÃO DE COMBATE
                    </div>
                    <div className="text-[11px] font-medium text-foreground/80 leading-snug">
                      {b.behavior}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "obstaculos" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {OBSTACLE_INFO.map((o) => (
            <ObstacleCard key={o.id} info={o} />
          ))}
        </div>
      )}

      {tab === "itens" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ITEM_INFO.map((i) => (
            <ItemCard key={i.id} info={i} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------ cards ------------------------------ */

function StatMeter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-[9px] font-black tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      <div className="flex gap-1" aria-label={`${label}: ${value} de 5`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={cn("h-1.5 w-4 rounded-full", i < value ? "" : "bg-secondary/70")}
            style={i < value ? { background: color } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function EnemyCard({ info }: { info: EnemyInfo }) {
  return (
    <article
      className="group rounded-xl border border-border/70 bg-card/60 backdrop-blur p-4 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
      style={{ borderTopColor: info.accent, borderTopWidth: 2 }}
    >
      <div className="flex items-start gap-4">
        <div className="float-ship">
          <SpritePreview id={info.id} size={104} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <Badge variant="outline" className="text-[10px]">
              {info.kind}
            </Badge>
            <Badge variant="default" className="text-[10px]">
              {info.points} PTS
            </Badge>
            {info.hp > 1 && <Badge variant="info" className="text-[10px]">{info.hp}× HP</Badge>}
            <Badge variant="secondary" className="text-[10px]">
              CAP. {info.firstChapter}+
            </Badge>
          </div>
          <h3 className="font-black text-foreground leading-tight">{info.name}</h3>
          <p className="text-[11px] font-bold mt-0.5" style={{ color: info.accent }}>
            “{info.tagline}”
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{info.description}</p>
      <div className="mt-3 rounded-lg bg-secondary/50 px-3 py-2">
        <div className="text-[9px] font-black tracking-widest text-muted-foreground mb-1">
          COMPORTAMENTO
        </div>
        <div className="text-[11px] font-medium text-foreground/80 leading-snug">
          {info.behavior}
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        <StatMeter label="Perigo" value={info.stats.danger} color="#ef4444" />
        <StatMeter label="Velocidade" value={info.stats.speed} color="#38bdf8" />
        <StatMeter label="Agressivo" value={info.stats.aggression} color="#f59e0b" />
      </div>
    </article>
  );
}

function ObstacleCard({ info }: { info: ObstacleInfo }) {
  return (
    <article
      className="group rounded-xl border border-red-900/50 bg-card/60 backdrop-blur p-4 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
      style={{ borderTopColor: info.accent, borderTopWidth: 2 }}
    >
      <div className="flex items-start gap-4">
        <SpritePreview id={info.id} size={104} zoom={info.id === "bridge" ? 0.85 : 1} />
        <div className="min-w-0 flex-1">
          <Badge variant="destructive" className="mb-1">
            <TriangleAlert className="size-3" aria-hidden />
            MALEFÍCIO
          </Badge>
          <h3 className="font-black text-foreground leading-tight">{info.name}</h3>
          <p className="text-[11px] font-bold mt-0.5" style={{ color: info.accent }}>
            “{info.tagline}”
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{info.description}</p>
      <div className="mt-3 rounded-lg border border-red-900/40 bg-red-950/40 px-3 py-2">
        <div className="text-[9px] font-black tracking-widest text-red-400 mb-0.5">
          EFEITO NO PILOTO
        </div>
        <div className="text-[11px] font-bold text-red-200/90 leading-snug">{info.effect}</div>
      </div>
    </article>
  );
}

function ItemCard({ info }: { info: ItemInfo }) {
  return (
    <article
      className="group rounded-xl border border-green-900/50 bg-card/60 backdrop-blur p-4 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
      style={{ borderTopColor: info.accent, borderTopWidth: 2 }}
    >
      <div className="flex items-start gap-4">
        <SpritePreview id={info.id} size={104} />
        <div className="min-w-0 flex-1">
          <Badge variant="default" className="mb-1">
            <Sparkles className="size-3" aria-hidden />
            BENEFÍCIO
          </Badge>
          <h3 className="font-black text-foreground leading-tight">{info.name}</h3>
          <p className="text-[11px] font-bold mt-0.5" style={{ color: info.accent }}>
            “{info.tagline}”
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{info.description}</p>
      <div className="mt-3 rounded-lg border border-green-900/40 bg-green-950/40 px-3 py-2">
        <div className="text-[9px] font-black tracking-widest text-green-400 mb-0.5">
          EFEITO NO PILOTO
        </div>
        <div className="text-[11px] font-bold text-green-200/90 leading-snug">
          {info.effect}
          {info.durationS ? (
            <span className="ml-1.5 text-[10px] font-black text-green-300/80">
              ⏱ {info.durationS}s
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
