# Revisão técnica adversarial — histórico de commits

> Auditoria estilo *pull request* dos 5 commits do repositório
> (`c0f316a` → `d1650c0`), conduzida em **3 rounds de "escrever teste →
> corrigir"** até a exaustão dos bugs detectáveis por testes de branch.
> Resultado: **230 testes automatizados** (`bun test`) e **21 correções**,
> incluindo um bug crítico de geração procedural presente desde o primeiro
> commit.

---

## 1. Escopo da revisão

| Commit | Conteúdo | Veredito |
|---|---|---|
| `c0f316a` | Scaffold inicial | ⚠️ `.env` rastreado (corrigido em commits seguintes) |
| `96cd066` | Jogo completo (14 k linhas) | 🔴 19 dos 21 bugs catalogados abaixo |
| `d6cdd86` | Docs (README + ANALISE) | ✅ consistente (auditoria anterior) |
| `5f588fa` | .gitignore de ferramentas | ✅ |
| `d1650c0` | Remove resíduo `download/` | ✅ |

O foco adversarial concentrou-se onde o risco mora: **branches rejeitados**
(validação de API, carga de saves), código de validação de fronteiras
(`shapeAt`, spawns) e máquinas de estado (morte/respawn/chefe).

---

## 2. Bugs encontrados e corrigidos

### 🔴 Críticos

**RIO-01 — Duplicação de nós do rio (presente desde o 1º commit).**
`ensure()` regredia `lastNodeY = y` DEPOIS de `pushLakeRun`/`pushIslandRun`
— que já haviam avançado `lastNodeY` até o fim do trecho. O loop então
regenerava nós **por cima** do lago/ilha, criando nós duplicados e fora de
ordem. A busca binária de `nodeIndexAt` exige ordenação estrita; corrompida,
o `shapeAt` passava a devolver formas **diferentes para o mesmo worldY**:
rio "pulsando" entre frames, depósitos/power-ups nascendo na terra, margens
fantomáticas. Detectado pelo teste de spawn seguro (flaky!) e provado com
dump de nós (`64680` e `65100` duplicados com valores distintos).
*Fix:* remoção das duas regressões de `lastNodeY`; testes de invariante
(nós estritamente crescentes em 30 seeds; `shapeAt` estável para qualquer
ordem de chamadas).

**API-01 — `GET /api/scores?limit=2.5` → 500.**
`Math.min(Math.max(Number("2.5"), 1), 50)` devolvia `2.5` para o Prisma,
que exige `Int` em `take` → `PrismaClientValidationError` → 500
controlável pelo atacante (spam de erro/log). *Fix:* `sanitizeLimit()`
(trunca, clamp, fallback para NaN) — [tests/round2.test.ts].

**SAVE-01 — Validação de `loadRun` incompleta (branch rejeitado furado).**
`typeof data.stage === 'number'` deixava passar:
- `stage: 1e300` → `stageStartY` gigante → `River.ensure` geraria
  **2,4 bilhões de nós** → travar a aba (loop síncrono ininterruptível);
- `missions` ausente → `missions.restore(undefined)` → TypeError →
  **tela branca** ao clicar em "Continuar partida";
- `score: NaN`/adulterado → `bestScore = Math.max(x, NaN) = NaN` →
  **profile corrompido para sempre** (NaN persiste no localStorage) e
  `NaN < custo` = false → **upgrades grátis no hangar**;
- `lives: 1e9` → vidas infinitas.
*Fix:* validação integral por campo (inteiros com faixa, missões com id
conhecido) + remoção do save inválido (auto-recuperação).

**SEC-01 — Rate-limit sem defesa de memória.**
O `Map` de IPs crescia ilimitado: um atacante girando o header
`x-forwarded-for` (spoofável) criava chaves infinitas → OOM. Além disso o
slot só era consumido em envio **válido** — spam de payloads inválidos não
era limitado. *Fix:* `RateLimiter` (poda de expirados, teto de chaves,
auto-reset sob inundação) + consumo de slot em toda tentativa
([src/lib/api-helpers.ts], testes com relógio injetado).

### 🟡 Médios

- **API-02** — corpo não-JSON → **500** (erro de cliente tratado como erro
  de servidor). *Fix:* try/catch em `req.json()` → 400.
- **SAVE-02** — `loadProfile` sem sanitização: `credits: NaN`/string,
  `upgrades: {speed: 99}` (stats quebrados), `localScores` com lixo,
  `settings` com tipos errados. *Fix:* sanitização campo a campo com clamps
  e whitelist de ids.
- **RIO-02** — `shapeAt` violava o contrato `[0,1]`: `center` clampado em
  `[0.32, 0.68]` com `halfWidth` até 0,395 produzia `left` negativo
  (medido: −0,00006; possível até −0,075). *Fix:* clamp de saída.
- **RIO-03** — `ensure()` sem teto: `shapeAt(1e12)` tentava gerar nós até
  1e12. *Fix:* teto de geração alinhado ao limite de fase do save
  (`stageStartY(1000)` ≈ 255 M px ≈ 6,6 dias de voo); além disso o rio
  congela na última forma em vez de travar.
- **GAME-01** — power-ups podiam nascer **em cima da ilha** (spawn usava
  faixa bruta `left..right` em vez do `spawnXAt` que evita ilhas) —
  coletável inalcançável que matava o jogador por tentar pegá-lo.
  *Fix:* `spawnXAt` no spawn de power-ups.
- **GAME-02** — idem para o cluster do lago secreto: `cx ± spread`
  geométrico podia cair sobre ilha nascente nas bordas do lago.
  *Fix:* cada posição do cluster via `spawnXAt`.
- **ENEMY-01** — barcos **atravessavam ilhas**: no canal esquerdo o limite
  `hi` era `islandRight` (o lado da direita!) — o barco "navegava" por
  cima da terra. *Fix:* intervalo por canal (`[left, islandLeft]` /
  `[islandRight, right]`).
- **BULLET-01** — teto de projéteis inimigos com off-by-one: `> 90`
  permitia 91. *Fix:* `>= 90`.
- **MISSION-01** — "Sobreviva 60 s" **nunca completava** com acumulação FP
  estacionária: a soma de 0,01×6000 convergia para 59,99999999999663
  (o incremento arredonda para baixo no double). *Fix:* épsilon na
  comparação + progress fixado no objetivo.
- **AUDIO-01** — ao sair do modo chefe o tempo 150 BPM "vazava" para o
  jogo normal até a próxima fase (`setBossMode(false)` não restaurava o
  tempo da fase). *Fix:* `stageTempo` memorizado.

### 🟢 Defensivos (hardening)

- **GAME-03** — `finishGameOver` blindado contra score NaN em runtime
  (não contamina bestScore/credits/localScores).
- **GAME-04** — `buyUpgrade` rejeita `credits` não-finito.
- **MISSION-02** — `restore()` defensivo: não-array e entradas inválidas
  são ignoradas; `progress ≥ goal` restaurado implica `completed`.
- **UPGRADE-01** — `applyUpgrades` clampa níveis (profile adulterado não
  gera stats de 27 000 px/s).
- **UTILS-01** — `clamp(NaN)` devolvia NaN (propagação pela física);
  agora devolve o mínimo. `pick()`/`spawnXAt` blindados contra `rng() = 1`.

---

## 3. Metodologia: rounds de "escrever teste para o fix"

Estratégia pedida: **testes que exercitam branches específicos** para
revelar o que revisão manual não pega — e repetir enquanto cada correção
revelar bugs adjacentes.

### Round 1 — branch rejeitado (61 testes falhando → 0)
Suíte inicial mirando os branches de rejeição: validação zod da API (400),
rate-limit (429), JSON inválido (500→400), `?limit` malformado, e todas as
formas de save adulterado. O harness headless (canvas via Proxy, window/
localStorage/raf stubados) permitiu rodar o `Game` real fora do navegador —
o teste de `continueRun` com save sem `missions` reproduziu a tela branca
com stack trace. O cenário `stage: 1e300` travava o runner de forma
síncrona — virou teste em subprocesso com timeout (travou → falha em vez
de congelar a suíte).

### Round 2 — adjacências das correções (4 falhas → 0)
Testes novos contra os pontos que as correções do Round 1 tocaram:
`RateLimiter` com relógio injetado (janela exata, não-renovação em bloqueio,
poda, reset sob inundação), boundaries do gatilho de chefe, roundtrip de
missões no checkpoint, spawns de depósitos. Revelou: `sanitizeLimit`
não tratava ±Infinity; `restore` não concluía missão já no objetivo; e o
spawn do lago ainda podia cair na ilha.

### Round 3 — o bug crítico escondido
O teste de "depósitos nunca na terra" continuava **flaky**. Cacada
determinística com dump de nós expôs duplicatas fora de ordem →
`RIO-01` (regressão de `lastNodeY`). Consertado, nasceram os testes de
invariante estrutural: nós estritamente crescentes em 30 seeds e `shapeAt`
estável para o mesmo worldY sob **qualquer padrão de chamadas**.

### Exaustão
Após o Round 3: **5 execuções completas da suíte com 230/230 verdes e
zero flakiness**; lint limpo; zero erros de console no navegador; API ao
vivo validada com curl (`?limit=2.5` → 200, JSON inválido → 400, slot de
rate-limit consumido em tentativa inválida); save corrompido injetado no
navegador real → botão "Continuar" desabilitado e página viva (tela branca
morto).

---

## 4. Como rodar

```bash
bun test          # 230 testes, ~1,7 s
bun run lint      # ESLint limpo
```

Estrutura dos testes (`tests/`):

| Arquivo | Cobertura |
|---|---|
| `api-scores.test.ts` | Rota de ranking: limit, zod 400, 429, poda, rank |
| `save.test.ts` | Branch rejeitado de loadRun/loadProfile (adulterações) |
| `systems.test.ts` | score/stages/missions/upgrades/campaign/audio/bullets/boss/enemies/utils |
| `river.test.ts` | Formas, canais de ilha, spawns, worldY patológico |
| `river-nodes.test.ts` | Invariantes estruturais (regressão RIO-01) |
| `game.test.ts` | Motor headless: estados, chefe, morte, checkpoints |
| `round2.test.ts` | Adjacências: RateLimiter, boundaries, roundtrips |
| `helpers.ts` / `fake-db.ts` | Stubs de browser + Prisma fake (com validação Int) |

> O fake do Prisma reproduz a validação real de `take`/`skip` como `Int` —
> foi o que permitiu ao teste capturar o `?limit=2.5` → 500 exatamente
> como aconteceria em produção.
