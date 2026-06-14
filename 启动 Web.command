#!/usr/bin/env bash
# macOS: double-click this file to install (if needed) and start the Web UI.
cd "$(dirname "$0")"

echo "========================================"
echo " Amazon UK Scraper — Web UI"
echo "========================================"
echo ""

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/')" -lt 18 ]]; then
  echo "First run: installing Node.js and dependencies..."
  bash scripts/install.sh
fi

bash scripts/web.sh

echo ""
echo "Press Enter to close this window..."
read -r _
