#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"

source "$DIR/env-proxy.sh"

if [ -f "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  source "$HOME/.nvm/nvm.sh"
  nvm use 20 >/dev/null 2>&1 || nvm use 18 >/dev/null 2>&1 || true
fi

cd "$ROOT"
exec node src/index.js "$@"
