#!/usr/bin/env bash
# macOS: double-click to serve release/*.zip on LAN.
cd "$(dirname "$0")"

echo "========================================"
echo " Amazon UK Scraper — 局域网下载"
echo "========================================"
echo ""

if ! ls release/*.zip >/dev/null 2>&1; then
  echo "未找到 zip，正在打包..."
  npm run pack
  echo ""
fi

node scripts/serve-release.js

echo ""
echo "Press Enter to close this window..."
read -r _
