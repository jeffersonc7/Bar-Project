#!/usr/bin/env bash
# Prepara el navegador de las pruebas E2E (Playwright) sin necesitar sudo.
# - Descarga Chromium headless de Playwright.
# - Si faltan librerías del sistema (WSL/Ubuntu recién instalado), las descarga como .deb y las
#   extrae en ~/.cache/caja-bar-libs (no instala nada en el sistema). `npm run test:e2e` las usa.
# Alternativa con sudo: `sudo npx playwright install-deps chromium`.
set -euo pipefail

npx playwright install chromium --only-shell

BIN=$(ls -d "$HOME"/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell | tail -1)
LIBS="$HOME/.cache/caja-bar-libs"
export LD_LIBRARY_PATH="$LIBS/raiz/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

faltan=$(ldd "$BIN" | awk '/not found/ {print $1}')
if [ -z "$faltan" ]; then
  echo "Navegador listo: no faltan librerías."
  exit 0
fi

echo "Faltan: $faltan"
mkdir -p "$LIBS/debs"
paquetes=()
for lib in $faltan; do
  case "$lib" in
    libnspr4.so*) paquetes+=(libnspr4) ;;
    libnss3.so* | libnssutil3.so* | libsmime3.so*) paquetes+=(libnss3) ;;
    libasound.so*) paquetes+=(libasound2t64) ;;
    *) echo "No sé qué paquete trae $lib; instálalo con: sudo npx playwright install-deps chromium" >&2 ;;
  esac
done
(cd "$LIBS/debs" && apt-get download $(printf '%s\n' "${paquetes[@]}" | sort -u))
for deb in "$LIBS"/debs/*.deb; do dpkg-deb -x "$deb" "$LIBS/raiz"; done

if ldd "$BIN" | grep -q "not found"; then
  echo "Todavía faltan librerías:" >&2
  ldd "$BIN" | grep "not found" >&2
  exit 1
fi
echo "Navegador listo."
