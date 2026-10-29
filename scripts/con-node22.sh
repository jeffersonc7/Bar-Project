#!/usr/bin/env bash
# Ejecuta un comando del proyecto con Node 22 aunque la terminal tenga activo otro Node
# (p. ej. el Node 18 del sistema en una terminal abierta antes de instalar nvm).
# Vite 7 necesita Node 20.19+; con Node 18 falla con "crypto.hash is not a function".
#   uso (desde package.json): bash scripts/con-node22.sh vite build
set -e

mayor=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$mayor" -lt 22 ]; then
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # npm define npm_config_prefix al lanzar scripts y nvm se niega a funcionar si existe.
    unset npm_config_prefix
    # shellcheck disable=SC1091
    . "$HOME/.nvm/nvm.sh"
    if ! nvm use 22 >/dev/null 2>&1; then
      echo "Esta app necesita Node 22 y no está instalado. Corre:  nvm install 22" >&2
      exit 1
    fi
  else
    echo "Esta app necesita Node 22 (tienes $(node -v 2>/dev/null || echo 'ninguno')). Instálalo con nvm: https://github.com/nvm-sh/nvm" >&2
    exit 1
  fi
fi

exec npx --no-install "$@"
