# 🛩️ River Raid Remaster

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

Homenagem **remasterizada** ao clássico **River Raid** (Activision, 1982) — um
shoot 'em up de navegação fluvial vertical com combustível, pontes, inimigos e
chefes — reconstruído como aplicação web moderna a partir do código gerado por
uma IA (documentado no PDF *Projeto River Raid Copilot*), **analisado,
corrigido e ampliado**.

> 📋 **Análise técnica completa**: a auditoria bug a bug do código original —
> incluindo **26 problemas catalogados**, como o loop sem proteção de
> delta-time, a velocidade dos inimigos multiplicada a cada frame, o chefe que
> só spawnava uma vez, os tiros do chefe que subiam em vez de mirar no jogador
> e o rio puramente decorativo — está em **[docs/ANALISE.md](docs/ANALISE.md)**.

---

## ▶️ Como rodar

```bash
bun install        # ou npm install
bun run db:push    # cria o banco SQLite do ranking global
bun run dev        # http://localhost:3000
```

> Requer [Bun](https://bun.sh) (ou Node 20+) — o jogo roda 100% no navegador.

---

## 🎮 O jogo

Pilote um caça pelo **Vale do Serpente Azul**: desvie das margens (tocar a
terra é fatal, como no clássico), destrua **pontes** para avançar de fase,
reabasteça nos depósitos do rio e derrote os **3 chefes** da campanha.

### Campanha (3 capítulos + modo infinito)

| Capítulo | Fases | Chefe |
|---|---|---|
| 1 — Rio Hostil | 1–3 | **Sentinela do Vale** (drone blindado, fase 3) |
| 2 — Zona de Conflito | 4–6 | **Aracno-Mecânico** (fortaleza móvel, fase 6) |
| 3 — Garganta de Ferro | 7–9 | **Núcleo da Garganta de Ferro** (chefe final, fase 9) |

Após o capítulo 3, o **modo infinito** continua com dificuldade e chefes
escalados.

### Sistemas

- **Rio procedural** (determinístico por seed): curvas, larguras variáveis,
  **ilhas**, **lagos secretos** com bônus e margens com vegetação.
- **Combustível**: consumo contínuo; depósitos **normais** (+35), **raros** ★
  (+70) e **falsos** ! (explodem e drenam — a partir da fase 5).
- **8 tipos de inimigos**: barco de patrulha, barco blindado (2 HP),
  helicóptero, helicóptero furtivo, jato, drone perseguidor, drone em
  zigue-zague e torre automática na margem.
- **Power-ups**: 🛡️ escudo, ⚡ tiro triplo, 🎯 míssil teleguiado, 🚀 turbo.
- **Pontuação** com **combo** (até ×5), vida extra a cada 10.000 pontos e
  bônus por ponte/chefe.
- **Missões** com recompensas (abates, coletas, sobrevivência, combo, chefe).
- **Hangar**: upgrades permanentes (velocidade, taxa de tiro, eficiência de
  combustível, duração do escudo) comprados com **créditos** ganhos ao fim de
  cada partida.
- **Checkpoints** automáticos por ponte/chefe + salvamento/continuação de
  partida.
- **Ranking global** (API + SQLite) e **local** (top 10).
- **Trilha sonora dinâmica** (sintetizada em tempo real, acelera com a fase) e
  efeitos sonoros procedurais — sem nenhum arquivo de áudio.
- **Modo retro CRT** opcional (scanlines + pixelização + saturação).

### Controles

| Ação | Teclado | Gamepad | Toque |
|---|---|---|---|
| Mover | WASD / setas | analógico esq. / D-pad | joystick virtual |
| Atirar | espaço | A / X / RB | botão FOGO |
| Pausar | P / Esc | Start | botão ⏸ |
| Som | M | — | menu |

💡 **Dica**: acelerar para o topo da tela aumenta a velocidade do mundo (e o
risco) — o acelerador do River Raid original.

---

## 🏗️ Arquitetura

```
src/
├── app/
│   ├── page.tsx              # página única (jogo + rodapé fixo)
│   ├── layout.tsx            # metadados + tema dark
│   └── api/scores/route.ts   # ranking global (GET/POST + validação + rate-limit)
├── components/game/          # UI React (HUD, menus, cutscenes, ranking, toque)
└── game/                     # motor do jogo (TypeScript puro, sem React)
    ├── Game.ts               # orquestrador + máquina de estados + colisões
    ├── types.ts / utils.ts
    ├── engine/               # áudio procedural e partículas (loop 60 Hz vive no Game.ts)
    ├── input/                # teclado + gamepad (polling) + toque
    ├── world/                # rio procedural
    ├── entities/             # player, bullets, enemies, boss, pickups
    └── systems/              # score, stages, missions, upgrades, campaign, save
prisma/schema.prisma          # modelo Score (ranking global)
```

**Decisões de engenharia** (detalhes em
[docs/ANALISE.md](docs/ANALISE.md#4-decisões-de-engenharia)):

- **Canvas 2D** em vez de WebGL2/WebGPU: compatibilidade máxima e 60 fps
  estáveis para a densidade de entidades deste jogo; a separação lógica ↦
  renderização permite migrar o renderizador no futuro sem tocar na simulação.
- **Gamepad API** em vez de WebHID: cobre nativamente controles Xbox /
  PlayStation / genéricos, sem permissões intrusivas de emparelhamento.
- **Áudio 100% sintetizado** (WebAudio): resolve de vez os assets inexistentes
  do projeto original e viabiliza a trilha dinâmica.
- **Loop com timestep fixo** (60 Hz) e dt clampado: física determinística,
  imune a abas em segundo plano.
- **Lógica isolada da UI**: o motor não conhece React; a UI assina um
  `HudState` tipado atualizado ~10×/s.

---

## ✅ Qualidade

- **Lint limpo** (`bun run lint`).
- **Testes E2E de navegador** (agent-browser): fluxo completo verificado —
  menu → intro de capítulo → gameplay (movimento, tiro, combustível, margens,
  inimigos) → destruição de ponte → avanço de fase → checkpoint → luta de chefe
  (spawn, fases internas, projéteis mirados, derrota) → intro do capítulo 2 →
  pausa → salvar/sair → continuar → fim de jogo → envio ao ranking global →
  API validada. Screenshots auditados por modelo de visão.
- **Persistência versionada** com proteção contra dados corrompidos.

---

## 📚 Créditos e contexto

- **River Raid** — design original de Carol Shaw (Activision, 1982). Este
  projeto é uma homenagem não-comercial, com código e arte próprios.
- O ponto de partida foi o código gerado por IA no PDF
  *Projeto River Raid Copilot* (do próprio repositório de uploads do autor);
  toda a análise, correção e evolução está documentada em
  [docs/ANALISE.md](docs/ANALISE.md) e no histórico de commits.
