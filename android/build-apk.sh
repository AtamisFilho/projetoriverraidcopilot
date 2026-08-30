#!/usr/bin/env bash
# =============================================================================
# River Raid Remaster — build do APK Android (SEM Gradle)
#
# Pipeline direto com as ferramentas do Android SDK:
#   1. (opcional) bundle web autossuficiente  →  app/src/main/assets/www
#   2. aapt2 compile+link   → recursos + manifest + assets  → base.apk
#   3. ecj (compilador Java) → classes
#   4. d8                    → classes.dex
#   5. zip (classes.dex) + zipalign
#   6. apksigner             → APK assinado
#
# Pré-requisitos:
#   - JDK 11+ (java/keytool)                     → apt install openjdk-21-jre-headless
#   - Android SDK: platforms;android-34, build-tools;34.0.0
#       mkdir -p ~/android-sdk/cmdline-tools
#       unzip commandlinetools-linux-*.zip -d ~/android-sdk/cmdline-tools
#       mv ~/android-sdk/cmdline-tools/cmdline-tools ~/android-sdk/cmdline-tools/latest
#       yes | ~/android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=$HOME/android-sdk \
#            "platforms;android-34" "build-tools;34.0.0"
#   - ecj.jar (compilador Java que roda só com JRE):
#       curl -L -o ~/android-sdk/ecj.jar \
#         https://repo1.maven.org/maven2/org/eclipse/jdt/ecj/3.36.0/ecj-3.36.0.jar
#   - bun + esbuild + @tailwindcss/cli (apenas se usar --www)
#
# Uso:
#   ./android/build-apk.sh            # compila o APK (usa www já existente)
#   ./android/build-apk.sh --www      # refaz o bundle web e compila o APK
#
# Variáveis de ambiente:
#   ANDROID_SDK_ROOT  → raiz do SDK (padrão ~/android-sdk)
#   APK_KEYSTORE      → keystore de assinatura (padrão android/debug.keystore,
#                       gerado automaticamente com senhas "android")
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${0}")/.." && pwd)"
SDK="${ANDROID_SDK_ROOT:-$HOME/android-sdk}"
BT="$SDK/build-tools/34.0.0"
PLATFORM="$SDK/platforms/android-34/android.jar"
ECJ="$SDK/ecj.jar"
APP="$ROOT/android/app"
RES="$APP/src/main/res"
MANIFEST="$APP/src/main/AndroidManifest.xml"
JAVA_SRC="$APP/src/main/java/com/atamisfilho/riverraid/MainActivity.java"
WWW="$APP/src/main/assets/www"
OUT="$ROOT/android/build"
DIST="$ROOT/android/dist"
KS="${APK_KEYSTORE:-$ROOT/android/debug.keystore}"

VERSION_NAME="2.2.0"
VERSION_CODE="2"
APK_NAME="river-raid-remaster-$VERSION_NAME.apk"

say()  { printf '\033[1;32m▸ %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- pré-cheques
for tool in "$BT/aapt2" "$BT/d8" "$BT/zipalign" "$BT/apksigner" "$PLATFORM"; do
  [ -e "$tool" ] || die "Ferramenta faltando: $tool — instale o Android SDK (veja cabeçalho do script)."
done
[ -e "$ECJ" ] || die "ecj.jar faltando: $ECJ — baixe de https://repo1.maven.org/maven2/org/eclipse/jdt/ecj/3.36.0/ecj-3.36.0.jar"
command -v java  >/dev/null || die "java não encontrado (JDK/JRE 11+)."
command -v keytool >/dev/null || die "keytool não encontrado (JDK)."
command -v zip   >/dev/null || die "zip não encontrado."

# ------------------------------------------------------- bundle web (opcional)
if [ "${1:-}" = "--www" ]; then
  command -v bun >/dev/null || die "bun não encontrado para gerar o bundle web."
  say "Gerando bundle web (esbuild + tailwind)…"
  (cd "$ROOT" && bun mobile/build-www.mjs)
fi
[ -f "$WWW/index.html" ] || die "Bundle web ausente ($WWW/index.html). Rode: ./android/build-apk.sh --www"

# ------------------------------------------------------------------- limpeza
rm -rf "$OUT" "$DIST"
mkdir -p "$OUT/classes" "$DIST"

# --------------------------------------------- 2) recursos + manifest + assets
say "aapt2: compilando recursos…"
"$BT/aapt2" compile --dir "$RES" -o "$OUT/res.zip"

say "aapt2: linking (manifest + assets)…"
# -A aponta para o diretório PAI (assets/): o conteúdo entra como assets/www/…,
# casando com a URL file:///android_asset/www/index.html do WebView.
"$BT/aapt2" link -o "$OUT/base.apk" \
  -I "$PLATFORM" \
  --manifest "$MANIFEST" \
  --min-sdk-version 21 --target-sdk-version 34 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  -A "$APP/src/main/assets" \
  "$OUT/res.zip"

# --------------------------------------------------- 3) compilação Java (ecj)
say "ecj: compilando MainActivity…"
java -jar "$ECJ" -source 8 -target 8 -nowarn -encoding UTF-8 \
  -classpath "$PLATFORM" \
  -d "$OUT/classes" \
  "$JAVA_SRC"

# ------------------------------------------------------------------ 4) dexing
say "d8: gerando classes.dex…"
"$BT/d8" --release --lib "$PLATFORM" --min-api 21 \
  --output "$OUT" \
  $(find "$OUT/classes" -name '*.class')

# --------------------------------------------- 5) empacota + alinha o classes.dex
say "Empacotando classes.dex…"
(cd "$OUT" && zip -q base.apk classes.dex)

say "zipalign…"
"$BT/zipalign" -f 4 "$OUT/base.apk" "$OUT/aligned.apk"

# ------------------------------------------------------------- 6) assinatura
if [ ! -f "$KS" ]; then
  say "Gerando keystore de assinatura ($KS)…"
  keytool -genkeypair -keystore "$KS" -alias androiddebugkey \
    -storepass android -keypass android \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Android Debug,O=Android,C=US" >/dev/null 2>&1
fi

say "apksigner: assinando $APK_NAME…"
"$BT/apksigner" sign \
  --ks "$KS" --ks-pass pass:android --key-pass pass:android \
  --ks-key-alias androiddebugkey \
  --out "$DIST/$APK_NAME" \
  "$OUT/aligned.apk"

# ------------------------------------------------------------------ verificação
say "Verificando assinatura…"
"$BT/apksigner" verify --print-certs "$DIST/$APK_NAME" | head -3

say "Badging do APK…"
"$BT/aapt2" dump badging "$DIST/$APK_NAME" | rg -N "package:|sdkVersion|targetSdkVersion|application-label:|launchable-activity" || true

SIZE=$(du -h "$DIST/$APK_NAME" | cut -f1)
printf '\n\033[1;32m✓ APK pronto: android/dist/%s (%s)\033[0m\n' "$APK_NAME" "$SIZE"
printf '  Instale com: adb install -r android/dist/%s\n' "$APK_NAME"
