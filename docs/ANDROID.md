# Android (APK) — River Raid Remaster

Guia completo do aplicativo Android: download e instalação, controles de toque,
compilação do APK do zero (sem Gradle), assinatura, atualização de versão e
solução de problemas.

## Visão geral

O River Raid Remaster roda no Android como um **APK nativo extremamente leve
(~280 KB)**: um invólucro mínimo de `WebView` que carrega um bundle web
autossuficiente (HTML + JS + CSS, sem Next.js) embutido dentro do próprio APK.

| Item | Valor |
| --- | --- |
| Pacote | `com.atamisfilho.riverraid` |
| Versão | 2.2.0 (`versionCode` 2) |
| Tamanho do APK | ~280 KB |
| SDK mínimo | 21 — Android 5.0+ (Android 8+ recomendado na prática) |
| SDK alvo | 34 — Android 14 |
| Permissões | apenas `VIBRATE` (vibração leve ao arrastar os controles) |
| Internet | **nenhuma** — sem permissão `INTERNET`, jogo 100% offline |
| Build | sem Gradle e sem AndroidX — ferramentas diretas do Android SDK |
| Orientação | retrato (portrait), tela cheia imersiva persistente |

Características principais:

- **Offline-first**: jogo, briefing, controles, sons e pulso EMP funcionam
  integralmente sem rede. O único recurso que depende de servidor é o ranking
  global, que exibe uma mensagem amigável no lugar (ver
  [Comportamento offline](#comportamento-offline)).
- **Código único**: o bundle é gerado a partir das **mesmas fontes** da versão
  web (`src/`) por esbuild + Tailwind CLI — zero duplicação de lógica de jogo.
- **Invólucro mínimo**: uma única classe Java (`MainActivity`, ~100 linhas) e
  nenhum framework nativo — daí o tamanho ridículo do APK e a ausência de
  dependências.
- Comportamentos nativos cuidados: tela sempre acesa em partida
  (`FLAG_KEEP_SCREEN_ON`), modo imersivo *sticky* (sem barras de status/navegação),
  botão **voltar** que pausa a partida antes de sair, e `WebView` congelada em
  `onPause` para economizar bateria.

### Novidades da v2.2.0

- **Níveis de 1–2 minutos** (1500 m cada) terminando em pontes blindadas, com
  dificuldade crescente e bônus a cada nível.
- **Configuração da missão** no menu: escolha de **1 a 6 naves** (quantas o
  piloto pode perder, respawnando no mesmo local) e do **nível inicial** (1–50).
- **Continuar do ponto salvo**: checkpoint automático ao pausar, sair para o
  menu ou perder todas as naves — o menu e a tela de fim de jogo oferecem
  **CONTINUAR — NÍVEL n**, retomando nível/distância/pontuação exatos.
- **Barra de controles inferior dedicada** — o rio roda acima dela; nave mais
  alta na tela; controle lateral mais suave; reposicionamento por arrastar-e-soltar
  apenas antes de decolar/pausado (sem reposicionamento acidental em jogo).

## Download e instalação

- **Release v2.2.0**:
  <https://github.com/AtamisFilho/projetoriverraidcopilot/releases/tag/v2.2.0>
- **Download direto do APK**:
  <https://github.com/AtamisFilho/projetoriverraidcopilot/releases/download/v2.2.0/river-raid-remaster-2.2.0.apk>
- Release anterior (v2.1.0):
  <https://github.com/AtamisFilho/projetoriverraidcopilot/releases/tag/v2.1.0>

### Instalando no aparelho (fontes desconhecidas)

1. Baixe o `river-raid-remaster-2.2.0.apk` direto no celular (ou transfira o
   arquivo para o aparelho).
2. Toque no arquivo baixado (notificação ou gerenciador de arquivos).
3. O Android avisará que o app vem de uma fonte desconhecida — toque em
   **Ajustes/Detalhes** e autorize o navegador ou gerenciador de arquivos a
   instalar aplicativos.
4. Confirme **Instalar**. O ícone "River Raid Remaster" aparece na gaveta de apps.

> O aplicativo pede apenas a permissão de vibração e não acessa a internet sob
> nenhuma circunstância — não há permissão `INTERNET` no manifesto.

### Instalando via adb (desenvolvedores)

```bash
adb install -r android/dist/river-raid-remaster-2.2.0.apk
```

A flag `-r` reinstala/atualiza preservando os dados — inclusive as posições
salvas dos controles de toque e o progresso da missão (checkpoint), que vivem
no `localStorage` da WebView (DOM storage habilitado no `MainActivity`).

## Controles de toque

Os controles virtuais (`src/components/game/VirtualControls.tsx`) aparecem
**automaticamente em dispositivos de toque** (detecção por
`(pointer: coarse)` e/ou `navigator.maxTouchPoints > 0`) dentro de uma
**barra inferior dedicada** (deck de ~176 px): a área do jogo — o rio por onde
a nave percorre — fica **acima** da barra, de modo que o dedo do piloto nunca
cobre a visão da área de jogo. A nave também voa um pouco mais alta, com
folga extra sobre a barra.

| Controle | Aparência | Função |
| --- | --- | --- |
| **Joystick digital** | Círculo grande (128 px) com chevrons | 8 direções: ← → mover, ↑ acelerar, ↓ frear (diagonais incluídas) |
| **TIRO** | Botão vermelho (84 px) com mira | Disparo contínuo enquanto pressionado |
| **GATILHO** | Botão azul (68 px) com raio + badge ×N | Pulso EMP — cargas limitadas (ver abaixo) |

### Reposicionamento (arrastar e soltar)

O reposicionamento é um **simples arrastar-e-soltar**, mas só está habilitado
**antes do início da partida ou com o jogo pausado** — durante o jogo o arrasto
é desativado por completo, para que segurar o dedo sobre o joystick nunca
reposicione os controles acidentalmente:

- **Antes de decolar** (tela "PREPARADO, PILOTO?") ou **pausado**: toque em
  qualquer controle e arraste diretamente para a nova posição (vibração leve
  de 14 ms onde suportado); solte para fixar (outra vibração de 10 ms).
- **Durante a partida**: os controles só executam suas ações (mover/atirar/EMP) —
  nenhum gesto os move.
- As posições são **normalizadas (0..1)** em relação à barra de controles e
  persistidas no `localStorage`, chave **`rr-controls-v2`** — valem para as
  próximas partidas e sobrevivem a reinstalações via `adb install -r`.
- O arrasto é limitado aos limites da barra (o controle nunca "escapa" da
  tela) e solta automaticamente os comandos que estavam ativos.
- **Redefinir**: o menu de pausa tem o botão **REDEFINIR CONTROLES DE TOQUE**,
  que devolve os três controles às posições padrão e apaga o `localStorage`.
- Enquanto a edição está habilitada, um selo na parte superior da barra lembra:
  "Arraste os controles para reposicionar".

### Pulso EMP (o "gatilho")

| Atributo | Valor |
| --- | --- |
| Efeito | Onda de choque que **limpa todas as balas inimigas em tela** |
| Dano | **3** a cada inimigo comum na tela · **12** ao chefe |
| Cargas | inicia com **2** · máximo **3** · **+1 carga por chefe derrotado** |
| Recarga | cooldown de **0,6 s** entre pulsos |
| HUD | chip "EMP ×N" ao lado dos chips de armas; badge ×N no próprio botão |

Como disparar:

- Teclado: **K** ou **L**
- Gamepad: botões **B / R1 / R2** (índices 1/4/5 na Gamepad API)
- Toque: botão **GATILHO**

O motor usa *edge-latch* (detecção de borda): um toque curtíssimo — mesmo que
solto antes do próximo tick do loop de 120 Hz — nunca é "engolido"; o pulso é
sempre disparado. Toques durante o cooldown são descartados.

### Testando no desktop

Na versão web, abra o jogo com **`?touch=1`** (ex.:
`http://localhost:3000/?touch=1`) para forçar a exibição dos controles de toque
com o mouse — útil para depurar layout e reposicionamento sem um celular.

## Compilando o APK do zero

### Pré-requisitos

1. **JDK 11+** — apenas `java` e `keytool` (o compilador Java usado é o `ecj`,
   que roda sobre JRE; `javac` não é necessário):

   ```bash
   sudo apt install openjdk-21-jre-headless
   ```

2. **Android SDK** — cmdline-tools + plataforma 34 + build-tools 34.0.0
   (instalados por padrão em `~/android-sdk`; ajuste `ANDROID_SDK_ROOT` se usar
   outro caminho):

   ```bash
   mkdir -p ~/android-sdk/cmdline-tools
   unzip commandlinetools-linux-*.zip -d ~/android-sdk/cmdline-tools
   mv ~/android-sdk/cmdline-tools/cmdline-tools ~/android-sdk/cmdline-tools/latest
   yes | ~/android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=$HOME/android-sdk \
        "platforms;android-34" "build-tools;34.0.0"
   ```

3. **ecj.jar** — compilador Java do Eclipse (Maven Central), que dispensa o JDK
   completo:

   ```bash
   curl -L -o ~/android-sdk/ecj.jar \
     https://repo1.maven.org/maven2/org/eclipse/jdt/ecj/3.36.0/ecj-3.36.0.jar
   ```

4. **bun + dependências web** — `esbuild` e `@tailwindcss/cli` já estão nas
   `devDependencies` do projeto:

   ```bash
   bun install
   ```

5. Utilitários comuns: `zip`, `unzip` (normalmente já presentes).

### Build

```bash
bun run build:apk            # refaz o bundle web e compila o APK (recomendado)
# equivalentes:
./android/build-apk.sh --www # mesmo que acima
./android/build-apk.sh       # compila só o APK, usando o bundle www já existente
```

O script aborta com mensagens claras se faltar qualquer ferramenta (veja os
pré-cheques no topo de `android/build-apk.sh`).

### Saída esperada

```
▸ Gerando bundle web (esbuild + tailwind)…
▸ aapt2: compilando recursos…
▸ aapt2: linking (manifest + assets)…
▸ ecj: compilando MainActivity…
▸ d8: gerando classes.dex…
▸ Empacotando classes.dex…
▸ zipalign…
▸ apksigner: assinando river-raid-remaster-2.2.0.apk…
✓ APK pronto: android/dist/river-raid-remaster-2.2.0.apk (~280 KB)
```

O script também imprime a verificação da assinatura (`apksigner verify`) e o
*badging* do APK (`aapt2 dump badging` — pacote, SDKs, rótulo e activity
lançadora) como checagem final. Instale com:

```bash
adb install -r android/dist/river-raid-remaster-2.2.0.apk
```

Arquivos regenerados por build (já no `.gitignore`): `android/build/`,
`android/dist/`, `android/debug.keystore` e
`android/app/src/main/assets/www/`.

## Como o build funciona (e por que não usa Gradle)

O pipeline é uma cadeia direta de ferramentas do Android SDK, orquestrada pelo
script `android/build-apk.sh` (~140 linhas de bash):

```
mobile/                                 android/
├─ main.tsx ──esbuild──▶ www/app.js   (~340 KB, IIFE minificado)
├─ tailwind.css ──tailwind CLI──▶ www/app.css
└─ index.html ─────────────▶ www/index.html
                                          │
   AndroidManifest.xml + res/ + assets/  │
            └─ aapt2 compile + link ─────┴─▶ base.apk
                                                 │
   MainActivity.java ──ecj──▶ .class ──d8──▶ classes.dex
                                                 │
                          classes.dex ──zip──▶ base.apk
                                                 │
                          base.apk ──zipalign 4──▶ aligned.apk
                                                 │
                          aligned.apk ──apksigner (v1+v2)──▶ dist/*.apk
```

Passo a passo:

1. **Bundle web** (`mobile/build-www.mjs`, opcional com `--www`): esbuild
   empacota React + jogo em um único `app.js` (IIFE, `es2019`, minificado); o
   Tailwind CLI gera o `app.css` escaneando `src/`; o `index.html` é copiado.
   Saída em `android/app/src/main/assets/www/`.
2. **aapt2 compile + link**: compila os recursos (`res/`) e vincula manifesto
   + recursos + assets em um `base.apk`. Detalhe importante: a flag `-A`
   aponta para o **diretório pai** (`assets/`), de modo que o conteúdo entra
   no APK como `assets/www/…`, casando com a URL
   `file:///android_asset/www/index.html` carregada pela WebView. As flags
   `--min-sdk-version`, `--target-sdk-version`, `--version-code` e
   `--version-name` são definidas aqui.
3. **ecj**: compila `MainActivity.java` (source/target 8) contra o
   `android.jar` da plataforma 34 — o ecj roda só com JRE, dispensando `javac`.
4. **d8**: converte os `.class` em `classes.dex` (`--min-api 21`, modo release).
5. **zip + zipalign**: adiciona o `classes.dex` ao APK e alinha os dados não
   comprimidos em fronteiras de 4 bytes (exigência do Android para acesso
   direto a recursos mapeados em memória).
6. **keytool + apksigner**: gera um keystore de depuração se não existir e
   assina o APK com esquemas **v1 + v2**, verificando a assinatura ao final.

**Por que não Gradle?** O aplicativo é uma única `Activity` com uma `WebView` —
não há AndroidX, não há dependências nativas, não há variantes de build.
Gradle + AGP trariam centenas de megabytes de ferramentas e uma etapa opaca
para… gerar o mesmo APK de 280 KB. O pipeline direto é **leve, reproduzível e
auditável** (todo o processo está visível em um script curto), depende apenas
do JDK e das build-tools, e roda em segundos.

## Estrutura do projeto

```
mobile/                          # bundle web autossuficiente (sem Next.js)
├── main.tsx                     # entry React: monta o GameShell no #root
├── index.html                   # host: viewport, fundo escuro, overlay de erro fatal
├── tailwind.css                 # Tailwind v4 (@source escaneia src/) + tokens visuais
└── build-www.mjs                # esbuild + tailwind CLI → android/…/assets/www

android/
├── build-apk.sh                 # pipeline completo: aapt2 → ecj → d8 → zip →
│                                #   zipalign → apksigner (+ pré-cheques e verificação)
├── app/src/main/
│   ├── AndroidManifest.xml      # pacote, versionCode/Name, VIBRATE, portrait,
│   │                            #   configChanges (evita recriação da Activity)
│   ├── java/com/atamisfilho/riverraid/
│   │   └── MainActivity.java    # WebView: JS + DOM storage, tela acesa, imersivo,
│   │                            #   botão voltar = pausa, freeze em onPause
│   ├── assets/www/              # bundle web gerado pelo build (gitignored)
│   └── res/
│       ├── values/strings.xml   # app_name = "River Raid Remaster"
│       ├── values/themes.xml    # Theme.Material.NoActionBar, fullscreen, barras pretas
│       └── mipmap-*/ic_launcher.png  # ícone (jato sobre o rio) em 5 densidades:
                                      #   48/72/96/144/192 px (mdpi…xxxhdpi)
```

### O que o `MainActivity` faz

- Habilita **JavaScript** e **DOM storage** (`localStorage` — posições dos
  controles e preferências) na WebView.
- `mediaPlaybackRequiresUserGesture(false)`: o áudio (WebAudio) toca logo após
  o toque em "DECOLAR", sem gesto extra por som.
- `FLAG_KEEP_SCREEN_ON`: a tela não apaga durante as partidas.
- **Modo imersivo sticky** reaplicado a cada ganho de foco — sem barra de
  status nem de navegação.
- **Botão voltar**: injeta JavaScript chamando `window.__rrGame.pause()` quando
  há partida em andamento (abre o menu de pausa do jogo); pressionado de novo
  ou fora de partida, encerra o app.
- `onPause`/`onResume` congelam/retomam a WebView (loop do jogo parado = bateria
  poupada em segundo plano); `onDestroy` chama `web.destroy()` para liberar tudo.

## Assinatura do APK

- **Keystore de depuração**: na primeira execução o script gera
  `android/debug.keystore` (se não existir) com `keytool` — RSA 2048,
  validade de 10 000 dias, alias `androiddebugkey`, senhas `android`
  (o par clássico de debug do Android). O keystore **não** vai para o git.
- **Usar seu próprio keystore**: aponte a variável de ambiente `APK_KEYSTORE`:

  ```bash
  APK_KEYSTORE=~/minhas-chaves/riverraid-release.keystore ./android/build-apk.sh
  ```

  Atenção: o script assina com `--ks-pass pass:android --key-pass pass:android`
  e `--ks-key-alias androiddebugkey`. Um keystore personalizado precisa usar
  essas mesmas credenciais — ou edite o bloco `apksigner sign` no
  `build-apk.sh` para refletir as suas.
- **Play Store**: a publicação exige um keystore de *release* próprio, guardado
  em sigredo absoluto (nunca commitado) e **a mesma assinatura em todas as
  atualizações** — o Android recusa atualizar um app cuja assinatura difira da
  instalada. O APK atual é assinado com chave de depuração: perfeito para
  distribuição via GitHub Releases/instalação manual, mas não pronto para a
  Play Store.
- A assinatura usa os esquemas **v1 + v2** e é verificada (`apksigner verify`)
  ao final de todo build.

## Atualizando a versão

A versão vive em **três lugares** (mantenha os três em sincronia):

| Arquivo | O que alterar |
| --- | --- |
| `android/build-apk.sh` | `VERSION_NAME="2.2.0"` e `VERSION_CODE="2"` — **são estes valores que entram de fato no APK** (flags `--version-name`/`--version-code` do `aapt2 link`) e que definem o nome do arquivo em `android/dist/` |
| `android/app/src/main/AndroidManifest.xml` | `android:versionName` / `android:versionCode` — mantidos por consistência/leitura do manifesto (as flags do `aapt2` têm precedência) |
| `package.json` | `"version": "2.2.0"` |

Regra de bolso: a cada release, incremente `versionCode` em +1 (o Android usa
esse inteiro para ordenar versões) e atualize `versionName` para a versão
legível (ex.: 2.2.0). Depois rode `bun run build:apk` e anexe o novo APK à
Release correspondente no GitHub.

## Comportamento offline

O manifesto **não declara permissão `INTERNET`**: o sistema garante, em nível
de sandbox, que o app nunca acessa a rede. O único recurso que exigiria
servidor é o ranking global — no APK, tanto o painel de ranking quanto a tela
de fim de jogo exibem a mensagem amigável:

> "No aplicativo Android o jogo é 100% offline — o ranking global fica
> disponível na versão web."

Tudo o mais (motor de jogo, níveis e checkpoint de progresso, briefing tático,
controles de toque, áudio sintetizado, pulso EMP, pausa via botão voltar)
funciona integralmente offline — o progresso salvo (continuar do ponto onde
parou) e a configuração de missão vivem no `localStorage` da WebView.

## Limitações conhecidas

- **Ranking global indisponível no APK** (por design, offline-first) — exibe a
  mensagem amigável acima; o ranking completo vive na versão web.
- **Assinatura de depuração** — o APK distribuído não está pronto para a Play
  Store (ver [Assinatura](#assinatura-do-apk)).
- **Motor de renderização**: o jogo roda na `WebView` do sistema
  (Android System WebView). Embora o `minSdk` seja 21 (Android 5.0), versões
  antigas dessa WebView têm motores JS mais lentos — **recomenda-se Android 8+
  na prática** para melhor desempenho.
- **Sem Google Play Services** — sem autologin, conquistas ou atualização
  automática; a distribuição é manual via GitHub Releases.
- **Orientação fixa em retrato** — jogar em paisagem não é suportado (por
  design; o jogo é vertical 9:16).

## Solução de problemas

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| Tela preta/branca ao abrir o app | bundle `www` ausente ou desatualizado dentro dos assets | confira `android/app/src/main/assets/www/index.html` e recompile com `./android/build-apk.sh --www` |
| "App não instalado" / instalação bloqueada | fonte desconhecida não autorizada | autorize o navegador/gerenciador de arquivos a instalar apps (Ajustes → Apps → permissões especiais → instalar apps desconhecidos) |
| Controles de toque não aparecem | controles só aparecem em dispositivos de toque | em telas desktop (versão web) use `?touch=1` para forçá-los; no APK eles sempre aparecem |
| "Assinaturas conflitantes" ao atualizar | APK anterior assinado com keystore diferente | desinstale a versão antiga antes de instalar (perde as posições dos controles) ou mantenha sempre o mesmo keystore |
| `aapt2`/`d8`/`zipalign`/`apksigner` não encontrados | SDK em caminho não padrão | exporte `ANDROID_SDK_ROOT=/caminho/do/sdk` (padrão `~/android-sdk`) |
| `ecj.jar faltando` | compilador Java não baixado | `curl -L -o ~/android-sdk/ecj.jar https://repo1.maven.org/maven2/org/eclipse/jdt/ecj/3.36.0/ecj-3.36.0.jar` |
| Sem áudio | volume de mídia do aparelho no zero ou jogo no mudo | verifique o **volume de mídia** (não o de toque/notificações) e o botão de som do jogo |

## Verificações realizadas (E2E)

Antes da publicação da v2.2.0, o pacote Android foi verificado ponta a ponta:

- **Joystick digital**: 8 direções via eventos de ponteiro reais — nave desloca
  com a nova física suavizada (≈215 px/s de velocidade lateral de pico).
- **Reposicionamento**: arrastar-e-soltar dos três controles **antes de decolar**
  e **com o jogo pausado** (drag imediato), persistência em `localStorage`
  (`rr-controls-v2`) e **impossibilidade de arrastar durante a partida** (posição
  e chave de persistência idênticas antes/depois da tentativa).
- **Barra inferior dedicada**: geometria medida no viewport 390×844 — canvas do
  jogo de 0 a 668 px, barra de controles de 668 a 844 px, joystick/tiro/gatilho
  contidos na barra (nenhuma sobreposição com o rio) e nave visível acima dela.
- **Níveis**: fronteira em 3000 m — HUD "NÍVEL 2 → NÍVEL 3", capítulo 1 → 2,
  bônus de nível somado à pontuação.
- **Configuração de missão**: seletores de naves (1–6) e nível inicial (1–50)
  persistidos em `rr-config-v1`; partida iniciada no nível 2 com 5 naves.
- **Continuar**: checkpoint gravado ao pausar, ao sair para o menu e no fim de
  jogo; retomada do ponto exato (nível/distância/pontuação/abates) com naves
  renovadas; botões CONTINUAR/JOGAR NOVAMENTE no topo da tela de fim de jogo.
- **Pulso EMP**: consumo de carga (2→1), dano exato no chefe (60→48 = −12),
  limpeza das balas inimigas, recarga ao derrotar chefe, cooldown engolindo
  toques subsequentes e *edge-latch* garantindo disparo em toques instantâneos
  (herdado da v2.1.0, sem regressões).
- **APK**: assinatura verificada (esquemas v1 + v2) e *badging* conferido via
  `aapt2 dump badging` (pacote, versionCode 2, SDKs, rótulo, activity lançadora).
- **Bundle via `file://`** no navegador desktop: motor, HUD, barra de controles
  (com `?touch=1`) e mensagens offline do ranking funcionando.
- `tsc --noEmit` e `eslint` limpos.
