#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ -x "$SCRIPT_DIR/.local-node/bin/node" && -x "$SCRIPT_DIR/.local-node/bin/npm" ]]; then
        NPM_CMD="$SCRIPT_DIR/.local-node/bin/npm"
        echo "Using local Node.js from .local-node"
elif command -v npm >/dev/null 2>&1; then
        NPM_CMD="npm"
        echo "Using system Node.js/npm"
else
        echo "Node.js not found. Run ./setup-node.sh first (recommended, non-global install)." >&2
        exit 1
fi

echo "[1/2] Installing dependencies..."
"$NPM_CMD" install --cache .npm-cache-local

echo "[2/2] Building project..."
"$NPM_CMD" run build
