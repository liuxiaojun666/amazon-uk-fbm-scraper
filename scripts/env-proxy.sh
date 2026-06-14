#!/usr/bin/env bash
# Source this file before running the scraper: source scripts/env-proxy.sh
export http_proxy=http://127.0.0.1:7897
export https_proxy=http://127.0.0.1:7897
export HTTP_PROXY=http://127.0.0.1:7897
export HTTPS_PROXY=http://127.0.0.1:7897

echo "Proxy set: $http_proxy"
