# River Raid Remaster — Projeto Copilot

Remasterização do clássico **River Raid** (Activision, 1982) como web app moderno,
construído com Next.js 16 + Canvas 2D em alta resolução.

## Destaques desta versão (Remaster HD)

1. **Gráficos significativamente melhorados e resolução atualizada**
   - Renderização HiDPI: o canvas usa `devicePixelRatio` (até 3×) — nítido em monitores
     Retina/4K e celulares modernos
   - Sprites vetoriais desenhados por código (jato, 8 inimigos, 3 chefes, itens) com
     gradientes, sombras, brilho especular e animação (rotores girando, pós-combustor)
   - Rio procedural com margens fatais, ilhas, rochas, espuma nas bordas, árvores,
     ondulações animadas e brilho de sol na água
   - Partículas, ondas de choque, screen shake, vinheta e paleta por capítulo
     (dia → desfiladeiro rubro → delta noturno)

2. **Medidor de combustível remasterizado + alerta de 10 segundos**
   - Medidor vertical com gradiente dinâmico (verde → âmbar → vermelho), marcações,
     zona crítica demarcada, percentual e **contagem de segundos restantes**
   - Quando restam **≤ 10 segundos** de combustível: banner piscante
     "⚠ COMBUSTÍVEL CRÍTICO", medidor pulsando em vermelho, borda vermelha na tela,
     destaque vermelho nos barris próximos e **bipe sonoro duplo** a cada 0,75 s

3. **Briefing tático na tela inicial**
   - Apresentação de **cada aeronave inimiga** com sprite real (mini-canvas animado),
     características, medidores de Perigo/Velocidade/Agressividade, pontos e capítulo
   - **Obstáculos (malefícios)**: margens, pontes blindadas, rochas e tanque falso
   - **Itens (benefícios)**: barril de combustível, combustível dourado, escudo,
     tiro triplo, míssil teleguiado e turbo
   - Abas INIMIGOS / OBSTÁCULOS / ITENS + seção de guardiões (chefes) e controles

## Gameplay

- 3 capítulos com chefes guardiões (Contratorpedeiro, Fortaleza Voadora, Porta-Aviões)
  e modo infinito após a vitória
- 8 tipos de inimigo com IA distinta (zigue-zague, perseguição, torres que miram, furtivo…)
- Power-ups, combustível raro, armadilhas explosivas, combo de abates (até ×4)
- Controles: teclado (setas/WASD + Espaço + P), **joystick via Gamepad API** e toque
- Áudio 100% sintetizado (WebAudio): motor, tiros, explosões, trilha dinâmica e alertas
- Ranking global persistido em SQLite (Prisma) via `/api/scores`

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Canvas 2D HiDPI ·
Prisma + SQLite · WebAudio API · Gamepad API

## Rodando

```bash
bun install
bunx prisma db push   # cria o banco db/custom.db
bun run dev           # http://localhost:3000
```

## Estrutura

```
src/
├── app/
│   ├── api/scores/route.ts   # GET top-10 / POST com validação
│   ├── layout.tsx · page.tsx
│   └── globals.css           # tema, animações (alerta crítico etc.)
├── components/game/
│   ├── GameShell.tsx         # máquina de estados (menu/jogo/fim)
│   ├── GameScreen.tsx        # canvas + HUD + pausa
│   ├── FuelGauge.tsx         # medidor de combustível + alerta ≤10s
│   ├── BriefingSection.tsx   # apresentação de inimigos/obstáculos/itens
│   ├── SpritePreview.tsx     # mini-canvas com sprite real do jogo
│   ├── MenuScreen.tsx · GameOverScreen.tsx · RankingPanel.tsx
│   └── TouchControls.tsx     # controles móveis (pointer coarse)
└── lib/game/
    ├── engine.ts             # motor: loop fixo 120 Hz, rio procedural, colisões
    ├── sprites.ts            # biblioteca de sprites vetoriais
    ├── audio.ts              # sintetizador WebAudio
    ├── content.ts            # bestiário (dados compartilhados jogo+briefing)
    └── types.ts              # tipos e constantes
```

> Remasterização educacional, sem fins comerciais. River Raid é marca da Activision.
