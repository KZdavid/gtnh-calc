#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true

if [[ -x "$SCRIPT_DIR/.local-node/bin/node" ]]; then
  NODE_BIN="$SCRIPT_DIR/.local-node/bin/node"
elif command -v node >/dev/null 2>&1; then
  NODE_BIN="node"
else
  echo "Node.js not found. Run install.sh first, or: bash install.sh" >&2
  exit 1
fi

if [[ ! -d "$SCRIPT_DIR/dist" ]]; then
  echo "dist/ not found. Run install.sh first, or: bash install.sh" >&2
  exit 1
fi

"$NODE_BIN" "$SCRIPT_DIR/scripts/minimal-release/serve-dist.cjs"
