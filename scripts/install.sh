#!/usr/bin/env bash
# One-shot setup: install Node.js (if missing) + npm deps + Playwright Chromium
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
NODE_MAJOR_MIN=18
NODE_VERSION=20

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}==>${NC} $*"; }
warn()  { echo -e "${YELLOW}!!>${NC} $*"; }
fail()  { echo -e "${RED}ERROR:${NC} $*" >&2; exit 1; }

node_major() {
  node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/'
}

node_ok() {
  command -v node >/dev/null 2>&1 || return 1
  local major
  major="$(node_major)"
  [[ -n "$major" && "$major" -ge "$NODE_MAJOR_MIN" ]]
}

load_nvm() {
  if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    source "$HOME/.nvm/nvm.sh"
    return 0
  fi
  return 1
}

load_fnm() {
  if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env)"
    return 0
  fi
  if [[ -x "$HOME/.local/share/fnm/fnm" ]]; then
    export PATH="$HOME/.local/share/fnm:$PATH"
    eval "$(fnm env)"
    return 0
  fi
  return 1
}

try_version_managers() {
  if load_nvm; then
    nvm install "$NODE_VERSION" >/dev/null 2>&1 || nvm install "$NODE_MAJOR_MIN" >/dev/null 2>&1 || true
    nvm use "$NODE_VERSION" >/dev/null 2>&1 || nvm use "$NODE_MAJOR_MIN" >/dev/null 2>&1 || true
    node_ok && return 0
  fi
  if load_fnm; then
    fnm install "$NODE_VERSION" >/dev/null 2>&1 || fnm install "$NODE_MAJOR_MIN" >/dev/null 2>&1 || true
    fnm use "$NODE_VERSION" >/dev/null 2>&1 || fnm use "$NODE_MAJOR_MIN" >/dev/null 2>&1 || true
    node_ok && return 0
  fi
  return 1
}

install_node_mac() {
  if command -v brew >/dev/null 2>&1; then
    info "Installing Node.js via Homebrew..."
    brew install node@20 2>/dev/null || brew install node
    brew link node@20 --force --overwrite 2>/dev/null || true
    node_ok && return 0
  fi

  info "Installing fnm (Fast Node Manager)..."
  curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell
  load_fnm || fail "fnm install finished but fnm is not on PATH. Open a new terminal and run: bash scripts/install.sh"
  fnm install "$NODE_VERSION"
  fnm use "$NODE_VERSION"
  node_ok && return 0
  return 1
}

install_node_linux() {
  if command -v apt-get >/dev/null 2>&1; then
    info "Installing Node.js via apt (NodeSource setup may be needed for v18+)..."
    if ! node_ok; then
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      sudo apt-get install -y nodejs
    fi
    node_ok && return 0
  fi

  info "Installing fnm..."
  curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell
  load_fnm || fail "fnm install finished but fnm is not on PATH. Open a new terminal and run: bash scripts/install.sh"
  fnm install "$NODE_VERSION"
  fnm use "$NODE_VERSION"
  node_ok && return 0
  return 1
}

install_node() {
  if node_ok; then
    info "Node.js already installed: $(node -v)"
    return 0
  fi

  warn "Node.js ${NODE_MAJOR_MIN}+ not found. Installing..."

  try_version_managers && return 0

  case "$(uname -s)" in
    Darwin) install_node_mac ;;
    Linux)  install_node_linux ;;
    *)
      fail "Unsupported OS. Install Node.js ${NODE_MAJOR_MIN}+ from https://nodejs.org/ then run: bash scripts/install.sh"
      ;;
  esac

  node_ok || fail "Node.js install failed. Install manually from https://nodejs.org/ (LTS 20+) and retry."
  info "Node.js installed: $(node -v)"
}

install_project_deps() {
  cd "$ROOT"
  node scripts/setup-deps.js
}

check_vpn_hint() {
  warn "Reminder: enable VPN with UK exit node and proxy on 127.0.0.1:7897 before scraping."
  warn "Check: bash scripts/check-vpn.sh"
}

main() {
  echo ""
  info "Amazon UK Scraper — first-time setup"
  echo ""

  install_node
  install_project_deps
  check_vpn_hint

  echo ""
  info "Setup complete!"
  echo ""
  echo "  Start Web UI:     npm run web"
  echo "  Or CLI scrape:    npm run scrape -- \"phone case\""
  echo "  macOS 双击启动:    ./启动 Web.command"
  echo "  Windows 双击启动:  启动 Web.bat"
  echo ""
}

main "$@"
