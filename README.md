# River Raid Remaster — Projeto Copilot

Remasterização do clássico **River Raid** (Activision, 1982) como web app moderno,
construído com Next.js 16 + Canvas 2D em alta resolução.

## 📱 Android (APK)

O jogo também roda **100% offline** no Android, empacotado como um APK nativo
ultraleve (~280 KB) — um invólucro mínimo de WebView, compilado **sem Gradle e
sem AndroidX**, direto com as ferramentas do Android SDK.

- **Download**:
  [`river-raid-remaster-2.2.0.apk`](https://github.com/AtamisFilho/projetoriverraidcopilot/releases/download/v2.2.0/river-raid-remaster-2.2.0.apk)
  (Release [v2.2.0](https://github.com/AtamisFilho/projetoriverraidcopilot/releases/tag/v2.2.0))
- **Instalação**: baixe no celular, toque no arquivo e autorize "instalar apps de
  fontes desconhecidas" — sem internet e sem permissões além da vibração
- **Controles de toque**: numa **barra inferior dedicada** (o rio roda acima dela,
  o dedo nunca cobre a área de jogo) ficam o joystick digital de 8 direções e os
  botões **TIRO** e **GATILHO** (pulso EMP). Para reposicionar, **arraste-os antes
  de decolar ou com o jogo pausado** — durante a partida o arrasto é desativado
  para evitar reposicionamento acidental; as posições ficam salvas no aparelho
- **Compilar do zero**: `bun run build:apk` — guia completo em
  [`docs/ANDROID.md`](docs/ANDROID.md)

## Destaques desta versão (Remaster HD)

1. **Sistema de níveis de 1–2 minutos com dificuldade crescente** *(v2.2.0)*
   - Cada nível tem **1500 m** (~75–110 s de voo) e termina numa **ponte blindada** —
     o portão clássico que precisa ser destruído a tiros
   - Ao cruzar cada ponte: banner **NÍVEL n**, bônus de pontos (200 + 100×nível) e
     dificuldade sobe — inimigos mais frequentes e velozes, rio mais estreito,
     mistura de inimigos mais agressiva, velocidade máxima maior
   - O HUD mostra **NÍVEL n · CAP m**; capítulos (paletas/chefes) seguem como zonas
     macro sobre os níveis

2. **Naves configuráveis e início no nível escolhido** *(v2.2.0)*
   - No menu, o cartão **CONFIGURAÇÃO DA MISSÃO** deixa escolher de **1 a 6 naves**
     (quantas o piloto pode perder, sempre respawnando **no mesmo local**) e o
     **nível inicial** (1–50) — as escolhas ficam salvas no aparelho

3. **Continuar do ponto salvo (checkpoint automático)** *(v2.2.0)*
   - Ao **pausar**, **sair para o menu** ou **perder todas as naves**, o ponto exato
     (nível, distância, pontuação, abates) é gravado no `localStorage`
   - O menu passa a oferecer **CONTINUAR — NÍVEL n** e a tela de fim de jogo traz o
     botão no topo — retome de onde parou, com a contagem de naves escolhida

4. **Layout mobile repensado** *(v2.2.0)*
   - Barra de controles inferior dedicada: a área do jogo fica **acima** dos botões,
     o dedo nunca cobre o rio; a nave voa um pouco mais alta, com folga sobre a barra
   - Controle lateral **mais suave e previsível** (aceleração e velocidade máxima
     reduzidas em ~1/3) — pilotar com o polegar ficou fácil
   - Tela de fim de jogo com **CONTINUAR / JOGAR NOVAMENTE no topo**, sem rolagem

5. **Gráficos significativamente melhorados e resolução atualizada**
   - Renderização HiDPI: o canvas usa `devicePixelRatio` (até 3×) — nítido em monitores
     Retina/4K e celulares modernos
   - Sprites vetoriais desenhados por código (jato, 8 inimigos, 3 chefes, itens) com
     gradientes, sombras, brilho especular e animação (rotores girando, pós-combustor)
   - Rio procedural com margens fatais, ilhas, rochas, espuma nas bordas, árvores,
     ondulações animadas e brilho de sol na água
   - Partículas, ondas de choque, screen shake, vinheta e paleta por capítulo
     (dia → desfiladeiro rubro → delta noturno)

6. **Medidor de combustível remasterizado + alerta de 10 segundos**
   - Medidor **compacto** ao lado do botão de pausa (mesma escala dos botões do HUD,
     ~4,5× menor que o painel original): barra vertical fina com gradiente dinâmico
     (verde → âmbar → vermelho), zona crítica demarcada, percentual e segundos restantes
   - Quando restam **≤ 10 segundos** de combustível: banner piscante
     "⚠ COMBUSTÍVEL CRÍTICO", medidor pulsando em vermelho, borda vermelha na tela,
     destaque vermelho nos barris próximos e **bipe sonoro duplo** a cada 0,75 s

7. **Sentido de voo corrigido**
   - O mundo agora flui de cima para baixo, como no clássico: inimigos nascem à frente
     (acima do topo da tela) e mergulham em direção ao jogador, o rio desce sob o jato
     e os tiros sobem pelo nariz da aeronave (mapeamento `tela Y = scroll + VH − worldY`)
   - Correções colaterais: balas dos chefes agora nascem no mundo correto (antes eram
     invisíveis), itens não nascem mais além do limite de descarte, rochas e inimigos
     que ficam para trás são descartados (colisão O(1) por região visível)

8. **Briefing tático na tela inicial**
   - Apresentação de **cada aeronave inimiga** com sprite real (mini-canvas animado),
     características, medidores de Perigo/Velocidade/Agressividade, pontos e capítulo
   - **Obstáculos (malefícios)**: margens, pontes blindadas, rochas e tanque falso
   - **Itens (benefícios)**: barril de combustível, combustível dourado, escudo,
     tiro triplo, míssil teleguiado e turbo
   - Abas INIMIGOS / OBSTÁCULOS / ITENS + seção de guardiões (chefes) e controles

## Gameplay

- **Níveis de 1500 m** (1–2 min) terminando em pontes blindadas, com dificuldade
  crescente e bônus a cada nível; capítulos com chefes guardiões (Contratorpedeiro,
  Fortaleza Voadora, Porta-Aviões) e modo infinito após a vitória
- **Configuração de missão**: escolha de 1 a 6 naves e do nível inicial (1–50)
- **Continuar**: checkpoint automático ao pausar/sair/perder — retome do ponto exato
- 8 tipos de inimigo com IA distinta (zigue-zague, perseguição, torres que miram, furtivo…)
- Power-ups, combustível raro, armadilhas explosivas, combo de abates (até ×4)
- **Pulso EMP (gatilho)**: onda de choque que limpa as balas inimigas e causa 3
  de dano a todos os inimigos em tela (12 no chefe) — começa com 2 cargas
  (máx. 3), recarrega ao derrotar um chefe e aparece no HUD como chip "EMP ×N"
- Controles: teclado (setas/WASD + Espaço + **K/L = pulso EMP** + P), **gamepad
  via Gamepad API** (B/R1/R2 disparam o EMP) e **controles de toque em barra
  inferior dedicada** (joystick digital de 8 direções, botões TIRO e GATILHO/EMP —
  reposicionáveis com arrastar-e-soltar **antes de decolar ou pausado**,
  persistentes no `localStorage`)
- Áudio 100% sintetizado (WebAudio): motor, tiros, explosões, trilha dinâmica e alertas
- Ranking global persistido em SQLite (Prisma) via `/api/scores`, com rate-limit
  por IP e validação rigorosa (endurecimento portado da revisão adversarial)
  — disponível na versão web; no APK offline o ranking exibe mensagem amigável

## Documentação

- [`docs/ANALISE.md`](docs/ANALISE.md) — análise técnica bug a bug do código original
  (gerado pela IA no PDF do projeto)
- [`docs/REVISAO-ADVERSARIAL.md`](docs/REVISAO-ADVERSARIAL.md) — revisão adversarial estilo
  PR dos primeiros commits, com as 21 correções e a suíte de 230 testes (estes documentos
  referem-se à primeira implementação, `src/game/*`, preservada no histórico em `3fbfe85`)
- [`docs/ANDROID.md`](docs/ANDROID.md) — guia do APK Android: download e instalação,
  controles de toque, compilação sem Gradle, assinatura e solução de problemas
- `worklog.md` — registro de trabalho das sessões de desenvolvimento

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Canvas 2D HiDPI ·
Prisma + SQLite · WebAudio API · Gamepad API · APK Android (WebView, build
sem Gradle)

## Rodando

```bash
bun install
bunx prisma db push   # cria o banco db/custom.db
bun run dev           # http://localhost:3000
```

Gerando o APK Android (offline):

```bash
bun run build:apk     # bundle web (esbuild+tailwind) + APK assinado em android/dist/
```

Pré-requisitos do APK (JDK, Android SDK, ecj) e detalhes em
[`docs/ANDROID.md`](docs/ANDROID.md).

## Estrutura

```
src/
├── app/
│   ├── api/scores/route.ts   # GET top-N (limit sanitizado) / POST com validação + rate-limit
│   ├── layout.tsx · page.tsx
│   └── globals.css           # tema, animações (alerta crítico etc.)
├── components/game/
│   ├── GameShell.tsx         # máquina de estados (menu/jogo/fim)
│   ├── GameScreen.tsx        # canvas + HUD + pausa
│   ├── FuelGauge.tsx         # medidor compacto de combustível + alerta ≤10s
│   ├── BriefingSection.tsx   # apresentação de inimigos/obstáculos/itens
│   ├── SpritePreview.tsx     # mini-canvas com sprite real do jogo
│   ├── MenuScreen.tsx · GameOverScreen.tsx · RankingPanel.tsx
│   └── VirtualControls.tsx   # controles de toque (barra inferior, arrastáveis antes/decolar/pausa)
└── lib/
    ├── api-helpers.ts        # rate-limit, sanitização de limit, IP do cliente
    └── game/
        ├── engine.ts         # motor: loop fixo 120 Hz, níveis, rio procedural, colisões
        ├── sprites.ts        # biblioteca de sprites vetoriais
        ├── audio.ts          # sintetizador WebAudio
        ├── content.ts        # bestiário (dados compartilhados jogo+briefing)
        ├── save.ts           # progresso/config persistidos (localStorage)
        └── types.ts          # tipos e constantes

mobile/                        # bundle web autossuficiente para o APK (sem Next.js)
├── main.tsx                   # entry React que monta o GameShell
├── index.html                 # host: viewport, fundo escuro, overlay de erro fatal
├── tailwind.css               # Tailwind v4 (@source escaneia src/) + tokens visuais
└── build-www.mjs              # esbuild + tailwind CLI → android/…/assets/www

android/                       # invólucro nativo WebView (sem Gradle/AndroidX)
├── build-apk.sh               # pipeline: aapt2 → ecj → d8 → zip → zipalign → apksigner
└── app/src/main/
    ├── AndroidManifest.xml    # pacote, VIBRATE (única permissão), portrait
    ├── java/…/MainActivity.java  # WebView: imersivo, back-pausa, freeze em onPause
    ├── res/                   # strings, tema fullscreen, ícones (5 densidades)
    └── assets/www/            # bundle web gerado em build (gitignored)
```

> Remasterização educacional, sem fins comerciais. River Raid é marca da Activision.
