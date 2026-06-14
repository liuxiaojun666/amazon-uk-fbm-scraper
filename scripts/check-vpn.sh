#!/usr/bin/env bash
# Verify VPN proxy exits in the UK (required for Amazon.co.uk FBM offers)
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./env-proxy.sh
source "$DIR/env-proxy.sh"

country=$(curl -s --max-time 12 -x "${HTTP_PROXY}" https://ipinfo.io/country | tr -d '[:space:]')
echo "Proxy exit country: ${country:-unknown}"

if [ "$country" = "GB" ]; then
  echo "OK: UK exit node — ready to scrape"
  exit 0
fi

echo "WARN: Not UK (got: ${country:-?}). Switch VPN to a UK node, then retry."
exit 1
