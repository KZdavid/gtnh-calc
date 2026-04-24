#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true

MIN_MAJOR=18
PREFERRED_VERSION="v22.14.0"
AUTO_YES=0

for arg in "$@"; do
  case "$arg" in
    -y|--yes) AUTO_YES=1 ;;
  esac
done

MIN_PACKAGES=(
  "typescript@5.8.2"
  "copyfiles@2.4.1"
  "javascript-lp-solver@0.4.24"
)

ensure_writable_paths() {
  local p
  local paths=(
    "$SCRIPT_DIR/assets"
    "$SCRIPT_DIR/assets/js"
    "$SCRIPT_DIR/dist"
    "$SCRIPT_DIR/.npm-cache-local"
  )

  for p in "${paths[@]}"; do
    mkdir -p "$p" 2>/dev/null || true
    chmod -R u+rwX "$p" 2>/dev/null || true
  done
}

assert_writable_assets() {
  if [[ ! -w "$SCRIPT_DIR/assets" ]]; then
    echo "assets/ is not writable. Trying to repair permissions..."
    chmod -R u+rwX "$SCRIPT_DIR/assets" 2>/dev/null || true
  fi

  if [[ ! -w "$SCRIPT_DIR/assets" ]]; then
    echo "assets/ is still not writable."
    echo "Run: chmod -R u+rwX \"$SCRIPT_DIR\""
    echo "Then retry: bash install.sh --yes"
    return 1
  fi
}

node_major() {
  "$1" --version | sed 's/^v//' | cut -d. -f1
}

setup_local_node() {
  local os arch_raw arch platform url download_dir archive extract_dir inner_dir
  os="$(uname -s)"
  arch_raw="$(uname -m)"

  case "$arch_raw" in
    x86_64) arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) echo "Unsupported CPU architecture: $arch_raw" >&2; return 1 ;;
  esac

  case "$os" in
    Darwin) platform="darwin" ;;
    Linux) platform="linux" ;;
    *) echo "Unsupported OS: $os" >&2; return 1 ;;
  esac

  download_dir="$SCRIPT_DIR/.local-node-download"
  archive="$download_dir/node.tar.gz"
  extract_dir="$download_dir/extract"

  mkdir -p "$download_dir"
  url="https://nodejs.org/dist/${PREFERRED_VERSION}/node-${PREFERRED_VERSION}-${platform}-${arch}.tar.gz"

  echo "Downloading Node.js ${PREFERRED_VERSION} (${platform}-${arch})..."
  curl -fL "$url" -o "$archive"

  rm -rf "$extract_dir"
  mkdir -p "$extract_dir"
  tar -xzf "$archive" -C "$extract_dir"

  inner_dir="$extract_dir/node-${PREFERRED_VERSION}-${platform}-${arch}"
  [[ -d "$inner_dir" ]] || { echo "Unexpected archive layout: $inner_dir" >&2; return 1; }

  rm -rf "$SCRIPT_DIR/.local-node"
  mv "$inner_dir" "$SCRIPT_DIR/.local-node"
}

prompt_use_local() {
  local reason ans
  reason="$1"
  echo "System Node.js unavailable/unusable: $reason"
  if [[ "$AUTO_YES" -eq 1 ]]; then
    ans="y"
  else
    read -r -p "Install local Node.js into this folder and continue? (y/N) " ans
  fi
  if [[ "$ans" =~ ^([yY]|[yY][eE][sS])$ ]]; then
    setup_local_node
  else
    echo "Aborted. Install Node.js >= ${MIN_MAJOR}, or rerun and choose local install." >&2
    exit 1
  fi
}

resolve_toolchain() {
  if [[ -x "$SCRIPT_DIR/.local-node/bin/node" && -x "$SCRIPT_DIR/.local-node/bin/npm" ]]; then
    local major
    major="$(node_major "$SCRIPT_DIR/.local-node/bin/node")"
    if [[ "$major" -ge "$MIN_MAJOR" ]]; then
      NODE_BIN="$SCRIPT_DIR/.local-node/bin/node"
      NPM_CMD="$SCRIPT_DIR/.local-node/bin/npm"
      TOOLCHAIN_SOURCE="local"
      export PATH="$SCRIPT_DIR/.local-node/bin:$PATH"
      return
    fi
  fi

  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    local major
    major="$(node --version | sed 's/^v//' | cut -d. -f1)"
    if [[ "$major" -ge "$MIN_MAJOR" ]]; then
      NODE_BIN="node"
      NPM_CMD="npm"
      TOOLCHAIN_SOURCE="system"
      return
    fi
    prompt_use_local "Node major version ${major} is lower than required ${MIN_MAJOR}"
  else
    prompt_use_local "node/npm not found in PATH"
  fi

  NODE_BIN="$SCRIPT_DIR/.local-node/bin/node"
  NPM_CMD="$SCRIPT_DIR/.local-node/bin/npm"
  TOOLCHAIN_SOURCE="local"
  export PATH="$SCRIPT_DIR/.local-node/bin:$PATH"
}

run_build() {
  cd "$SCRIPT_DIR"
  echo "Using ${TOOLCHAIN_SOURCE} Node.js toolchain"

  ensure_writable_paths
  assert_writable_assets || return 1

  if [[ "$TOOLCHAIN_SOURCE" == "local" ]]; then
    local npm_cli="$SCRIPT_DIR/.local-node/lib/node_modules/npm/bin/npm-cli.js"
    if [[ -f "$npm_cli" ]]; then
      "$NODE_BIN" "$npm_cli" install --no-save --cache .npm-cache-local "${MIN_PACKAGES[@]}"
      assert_writable_assets || return 1
      "$NODE_BIN" "$npm_cli" run build
      return
    fi
  fi

  "$NPM_CMD" install --no-save --cache .npm-cache-local "${MIN_PACKAGES[@]}"
  assert_writable_assets || return 1
  "$NPM_CMD" run build
}

resolve_toolchain

if run_build; then
  echo "Build succeeded."
  exit 0
fi

if [[ "$TOOLCHAIN_SOURCE" == "system" ]]; then
  if [[ "$AUTO_YES" -eq 1 ]]; then
    ans="y"
  else
    read -r -p "Build with system Node failed. Retry with local Node install? (y/N) " ans
  fi
  if [[ "$ans" =~ ^([yY]|[yY][eE][sS])$ ]]; then
    setup_local_node
    NODE_BIN="$SCRIPT_DIR/.local-node/bin/node"
    NPM_CMD="$SCRIPT_DIR/.local-node/bin/npm"
    TOOLCHAIN_SOURCE="local"
    export PATH="$SCRIPT_DIR/.local-node/bin:$PATH"
    run_build
    echo "Build succeeded with local Node."
    exit 0
  fi
fi

echo "Build failed. See errors above." >&2
exit 1
