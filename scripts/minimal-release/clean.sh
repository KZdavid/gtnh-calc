#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true

echo "Removing local dependencies/tools and build outputs in current folder..."
rm -rf node_modules dist release .npm-cache-local .local-node .local-node-download
echo "Cleanup done."
