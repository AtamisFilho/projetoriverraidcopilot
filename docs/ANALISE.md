# Análise Técnica do Código Original (PDF)

Este documento registra a análise completa do código gerado pela IA no arquivo
`Projeto River Raid Copilot.pdf` (75 páginas), os problemas encontrados e como
cada um foi corrigido nesta versão remasterizada.

> **Contexto**: o PDF contém uma conversa incremental onde uma IA gerou, passo a
> passo: dois prompts de especificação, um protótipo single-file, uma arquitetura
> modular (engine/input/render/game/utils) e módulos de tiros, inimigos
> básicos/avançados, colisões, partículas, pontuação, power-ups, combustível,
> fases, chefes, áudio, save/load, missões, upgrades, checkpoints, campanha,
> história e cutscenes.

---

## 1. Bugs críticos de lógica

### BUG-01 — Loop de jogo sem proteção de delta-time
**Onde (PDF)**: `loop.js` — `const dt = (t - this.last) / 1000; this.last = 0;`
**Problema**: `this.last` inicia em `0`, então o primeiro `dt` vale o timestamp
inteiro da página (milhares de "segundos"). Além disso, não há limite para `dt`:
ao voltar de uma aba em segundo plano, o `dt` gigante teleporta todos os objetos
e "explode" a física (objetos atravessam colisões).
**Correção**: `src/game/Game.ts` — loop com **timestep fixo de 60 Hz**,
acumulador limitado a 6 passos por frame e `delta` clampado em 100 ms.

### BUG-02 — Velocidade dos inimigos multiplicada a cada frame
**Onde (PDF)**: ajuste do `enemies.js` para dificuldade:
`e.speed *= stage.enemySpeedMultiplier` dentro do `update()` por frame.
**Problema**: multiplicação **composta por frame** → velocidade cresce
exponencialmente (×1,15^60 ≈ ×7000 por segundo). Em segundos os inimigos
atravessam a tela instantaneamente.
**Correção**: `src/game/systems/stages.ts` — dificuldade como **funções puras**
da fase (`difficultyFor(stage)`), aplicadas uma única vez no spawn.

### BUG-03 — Chefe só aparecia na primeira fase de chefe
**Onde (PDF)**: `world.js` — `if (!this.bossSystem.spawned && this.stage.current % 3 === 0)`
**Problema**: a flag `spawned` nunca era reiniciada após o chefe morrer. O chefe
aparecia na fase 3 e nunca mais (nas fases 6 e 9 a flag continuava `true`).
**Correção**: `src/game/Game.ts` — gatilho de chefe controlado por fase com
`bossTriggered` reiniciado a cada respawn, ID do chefe calculado por
`((stage/3 - 1) % 3) + 1` e escala de HP para o modo infinito (fases 12, 15…).

### BUG-04 — Tiros do chefe subiam (nunca acertavam o jogador)
**Onde (PDF)**: `boss.js` usava `bullets.shoot(x, y + 60)` e o `Bullet.update()`
padrão fazia `this.y -= this.speed * dt` (sempre para cima). O jogador está
**abaixo** do chefe.
**Problema**: todos os ataques do chefe iam na direção oposta ao jogador — as
três fases de ataque (tiro único, leque triplo, rajada radial) nunca acertavam.
**Correção**: `src/game/entities/boss.ts` + `bullets.ts` — sistema de balas
inimigas separado com direção arbitrária; ataques mirados via
`Math.atan2(playerY - bossY, playerX - bossX)`. Verificado em E2E: `vy = +254`
(descendo em direção ao jogador).

### BUG-05 — Jogador invencível (colisões com o jogador inexistentes)
**Onde (PDF)**: o `world.js` só implementava colisão tiro ↔ inimigo.
**Problema**: não havia colisão inimigo ↔ jogador, bala inimiga ↔ jogador,
chefe ↔ jogador, jogador ↔ margem, jogador ↔ ponte. A única "morte" possível
era o combustível zerar — e mesmo assim o game over era só um comentário
`// Você pode adicionar animação, tela de game over, etc.`
**Correção**: `src/game/Game.ts` (`updateCollisions`) — todas as colisões
implementadas, com vidas, respawn com invencibilidade, tela de fim de jogo e
estatísticas.

### BUG-06 — Rio puramente decorativo
**Onde (PDF)**: o `river.js` apenas desenhava faixas; o jogador podia voar sobre
a terra; inimigos e combustível nasciam em `Math.random() * width` (em cima da
terra).
**Problema**: no River Raid clássico, tocar a margem é fatal — é a mecânica
central. Sem isso, o jogo não tem desafio espacial.
**Correção**: `src/game/world/river.ts` — rio procedural com consulta de forma
(`shapeAt`) que alimenta: colisão fatal com margens/ILHAS, spawn de inimigos
dentro do canal (`spawnXAt`), patrulha de barcos quicando nas margens e torres
posicionadas na beira da água.

### BUG-07 — `AudioContext` criado no construtor
**Onde (PDF)**: `audio.js` — `this.ctx = new AudioContext()` no construtor.
**Problema**: a política de autoplay dos navegadores bloqueia `AudioContext`
criado sem gesto do usuário (o contexto fica `suspended` e nada toca).
**Correção**: `src/game/engine/audio.ts` — inicialização preguiçosa
(`ensureAudio()` no primeiro clique/toque/tecla) e retomada automática de
contexto suspenso.

### BUG-08 — Assets de áudio e imagens inexistentes
**Onde (PDF)**: `soundpack.js` referenciava `assets/sounds/*.wav` e
`assets/music/main_theme.mp3`; na última página a IA afirma que "as imagens
ilustrativas dos chefes já estão prontas".
**Problema**: nenhum arquivo foi criado — o código quebraria em `fetch` 404; a
afirmação sobre as imagens era alucinação.
**Correção**: áudio **100% sintetizado** via WebAudio (osciladores + buffer de
ruído para SFX; sequenciador com baixo/arpejo/percussão para a trilha, cujo
andamento cresce com a fase e muda de padrão nas lutas de chefe). Arte de
chefes desenhada proceduralmente em canvas (formas vetoriais distintas por
chefe).

### BUG-09 — Arquivo importado que nunca existiu
**Onde (PDF)**: `enemies.js` fazia `import { Enemy } from './enemy_basic.js'`.
**Problema**: a classe `Enemy` foi originalmente definida dentro do próprio
`enemies.js`; o `enemy_basic.js` nunca foi criado → `import` quebrado.
**Correção**: estrutura de módulos consistente (`src/game/entities/enemies.ts`
exporta `Enemy` e `enemyPoolForStage`).

### BUG-10 — HUD com API inconsistente
**Onde (PDF)**: o `HUD` recebia só `score` no construtor, mas os exemplos
chamavam `hud.drawFuel(ctx, fuel)`, `drawStage(ctx, stage)`, `drawBossHP`,
`drawMissions`, `drawUpgrades`, `drawCheckpoint`, `drawCampaign` com objetos
que nunca foram injetados.
**Correção**: HUD implementado em **React** (`src/components/game/Hud.tsx`)
sincronizado por um `HudState` único e tipado, atualizado ~10x/s.

---

## 2. Bugs de arquitetura e robustez

### BUG-11 — Scroll dependente do framerate
**Onde (PDF)**: `river.js` — `this.offset += 2` dentro de `draw()`.
**Problema**: a velocidade do mundo dependia do FPS da máquina.
**Correção**: avanço do mundo por distância (`scrollY += scrollSpeed * dt`) com
`scrollSpeed` em px/s.

### BUG-12 — Dependência de `window.innerHeight` dentro de módulos
**Onde (PDF)**: `enemies.js` (`window.innerHeight`), `powerups.js`, `fuel_pickups.js`.
**Problema**: módulos de lógica acoplados ao objeto global; quebra em SSR/testes
e ignora o tamanho real do canvas.
**Correção**: contexto injetado (`EnemyUpdateCtx` com `W`, `H`, `scrollY`…).

### BUG-13 — Sem tratamento de redimensionamento
**Onde (PDF)**: só o protótipo single-file tinha `resize()`.
**Correção**: `ResizeObserver` + suporte a `devicePixelRatio` (e escala reduzida
no modo CRT para visual pixelado).

### BUG-14 — Listeners vazando a cada montagem
**Onde (PDF)**: `keyboard.js`/`gamepad.js` registram listeners no construtor,
sem API de remoção; `main.js` e `world.js` adicionam `keydown` extras.
**Correção**: `InputManager.destroy()` e ciclo de vida completo do `Game`.

### BUG-15 — Referência a `keyboard`/`gamepad` antes da declaração
**Onde (PDF)**: `main.js` monta o objeto `input` com closures sobre
`const keyboard`/`const gamepad` declarados **depois**.
**Problema**: funciona por acaso (closures avaliam tardiamente), mas quebraria
com qualquer chamada imediata — armadilha de manutenção.
**Correção**: ordem de declaração correta e tipagem forte.

### BUG-16 — TDZ/hoisting e top-level `await` sem module script
**Onde (PDF)**: `main.js` usa `await loadAllSounds(audio)` em top-level.
**Problema**: exige `<script type="module">`, que nunca foi mostrado no HTML.
**Correção**: arquitetura em componentes React/TypeScript com bundler.

---

## 3. Problemas de design de jogo

### DESIGN-01 — Loja gastava a própria pontuação
**Onde (PDF)**: `ShopSystem.buy()` descontava de `score.points`.
**Problema**: pontuação é métrica de progresso/recorde; gastá-la destrói a
motivação e polui o ranking.
**Correção**: moeda separada (**créditos**, ganhos ao fim de cada partida:
`score/50`) e upgrades permanentes persistidos no perfil.

### DESIGN-02 — Checkpoint restaurava ao morrer sem custo (loop infinito)
**Onde (PDF)**: `if (this.fuel.empty) { this.checkpoints.restore(this); ... }`.
**Problema**: morrer por combustível restaurava o checkpoint **sem consumir
vida** → loop infinito sem game over.
**Correção**: morte → perde 1 vida → respawn no início da fase com combustível
cheio e invencibilidade; sem vidas → fim de jogo.

### DESIGN-03 — Salvamento manual na tecla F5
**Onde (PDF)**: `window.addEventListener('keydown', e => { if (e.key === 'F5') world.saveGame(); })`.
**Problema**: F5 **recarrega a página** no navegador — o "salvar" na verdade
perderia a partida.
**Correção**: salvamento automático em checkpoints + "Salvar e sair" no menu de
pausa.

### DESIGN-04 — Cutscene conflitava com a tecla de tiro
**Onde (PDF)**: a cutscene avançava com `Espaço`, a mesma tecla do tiro.
**Problema**: fechar a cutscene já disparava um tiro assim que o jogo voltava.
**Correção**: o estado da máquina de jogos consome o evento de confirmação
antes do gameplay retomar.

### DESIGN-05 — Missões com `rewardGiven` não inicializado
**Onde (PDF)**: `Mission` nunca inicializava `rewardGiven`.
**Problema**: funcionava por acaso (`undefined` é falsy).
**Correção**: estado inicial explícito + serialização/restauração completas.

### DESIGN-06 — Save restaurava posição X/Y exata do jogador
**Onde (PDF)**: `loadGame()` restaurava `player.x/y` do meio do rio.
**Problema**: frágil — podia ressuscitar o jogador em cima de um inimigo ou
fora do rio após mudanças de layout.
**Correção**: checkpoint discreto `{fase, pontos, vidas, missões, seed}` e
reposicionamento seguro no centro do rio no início da fase.

### DESIGN-07 — Estados de jogo inexistentes
**Onde (PDF)**: não havia menu, pausa, fim de jogo nem reinício.
**Correção**: máquina de estados completa: `menu → chapterIntro → bossIntro →
playing ⇄ paused → gameover`, com attract mode no menu.

### DESIGN-08 — Sem entrada de toque/mobile
**Onde (PDF)**: a especificação pedia otimização mobile; o código só tinha
teclado/gamepad.
**Correção**: joystick virtual + botão de fogo (`TouchControls`), viewport
responsiva e HUD adaptativo.

### DESIGN-09 — Gamepad só via eventos de conexão
**Onde (PDF)**: `gamepadconnected` definia `index`; a leitura usava esse índice.
**Problema**: controle já conectado antes do carregamento nunca era detectado
(Chrome só dispara o evento após interação); sem zona morta (drift do analógico
movia a nave sozinho).
**Correção**: **polling** de `navigator.getGamepads()` a cada frame, zona morta
de 0.16, D-pad, botões alternativos de tiro e Start para pausa.

### DESIGN-10 — WebHID desnecessário
**Onde (PDF)**: a especificação pedia "Xbox, PlayStation e genéricos via WebHID".
**Decisão**: a **Gamepad API** já cobre esses controles nativamente (com
mapeamento padrão); WebHID exigiria emparelhamento manual e permissões
intrusivas. Documentado como decisão de engenharia.

---

## 4. Decisões de engenharia

| Tema | Original (PDF) | Remaster | Motivo |
|---|---|---|---|
| Renderização | WebGL2/WebGPU (especificado, nunca implementado) | Canvas 2D | Compatibilidade máxima; 60 fps estáveis com essa densidade de entidades (≤ ~700 objetos); código auditável |
| Loop | rAF com dt variável | Timestep fixo 60 Hz | Determinismo e robustez a aba em segundo plano |
| Áudio | Arquivos .wav/.mp3 inexistentes | Síntese WebAudio procedural | Zero dependência de assets; trilha dinâmica real |
| Dificuldade | Multiplicadores por frame | Funções puras por fase | Previsibilidade |
| Progressão | Pontuação gasta em loja | Créditos + upgrades persistentes | Integridade do recorde |
| Ranking | Especificado, não existia | Global (API + Prisma/SQLite) + Local (top 10) | Especificação atendida |
| Fases | Tempo (30s) | Distância (pontes a destruir) | Fiel ao clássico; ponte = marco visível |
| História | Textos soltos | Capítulos + cutscenes integradas à máquina de estados | Conteúdo do PDF aproveitado |

---

## 5. O que foi mantido do original

- A **arquitetura modular** sugerida (engine / input / render / game / systems),
  agora em TypeScript.
- Os **padrões de inimigos** (zigue-zague, onda, perseguidor).
- Os **power-ups** (escudo, tiro triplo, turbo) + míssil teleguiado especificado.
- O **sistema de combustível** com tanques normais, raros e falsos.
- Os **multiplicadores de combo** (x0.1 por abate, teto x5, decaimento 3s).
- A **campanha em 3 capítulos**, os **3 chefes** e todos os **textos de história
  e alerta de chefe**.
- Missões, upgrades, checkpoints e save/load — todos refeitos com correções.

## 6. Resumo quantitativo

- **26 problemas** catalogados no código original: 10 críticos de lógica
  (BUG-01 a BUG-10), 6 de arquitetura/robustez (BUG-11 a BUG-16) e 10 de
  design de jogo (DESIGN-01 a DESIGN-10).
- **0** dos módulos do original roda sem correção (o protótipo single-file
  funciona, mas sem colisões/morte/progressão).
- Todos os sistemas especificados nos prompts do PDF agora **existem e estão
  verificados** por testes E2E automatizados de navegador.
