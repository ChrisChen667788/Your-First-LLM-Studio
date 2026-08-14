#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PRIMARY_NODE="/opt/homebrew/opt/node@22/bin/node"
NODE_BIN="${NODE22_BIN:-}"
CURRENT_NODE="$(command -v node || true)"

node_major_version() {
  local binary="$1"
  [[ -x "$binary" ]] || return 1
  "$binary" -p 'process.versions.node.split(".")[0]' 2>/dev/null
}

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "${line#\#}" != "$line" ]] && continue
    if [[ "$line" == *=* ]]; then
      local key="${line%%=*}"
      local value="${line#*=}"
      if printenv "$key" >/dev/null 2>&1; then
        continue
      fi
      value="${value%\"}"
      value="${value#\"}"
      value="${value%\'}"
      value="${value#\'}"
      export "$key=$value"
    fi
  done <"$file"
}

if [[ -z "$NODE_BIN" ]]; then
  if [[ -x "$PRIMARY_NODE" ]]; then
    NODE_BIN="$PRIMARY_NODE"
  elif [[ -n "$CURRENT_NODE" ]] && [[ "$(node_major_version "$CURRENT_NODE")" == "22" ]]; then
    NODE_BIN="$CURRENT_NODE"
  else
    echo "Node 22 binary not found. Install node@22 or set NODE22_BIN." >&2
    exit 1
  fi
fi

COMMAND="${1:-dev}"
PORT="${2:-3011}"
NEXT_DEV_DIST_DIR="${NEXT_DEV_DIST_DIR:-.next-local-dev}"
NEXT_BUILD_DIST_DIR="${NEXT_BUILD_DIST_DIR:-.next-build}"

cd "$ROOT"
load_env_file "$ROOT/.env.local"
load_env_file "$ROOT/.env"
WEB_HOST="${FIRST_LLM_WEB_HOST:-127.0.0.1}"
export PATH="$(dirname "$NODE_BIN"):$PATH"
export NODE="$NODE_BIN"
export npm_node_execpath="$NODE_BIN"
export NODE_BINARY="$NODE_BIN"
export LOCAL_AGENT_DATA_DIR="${LOCAL_AGENT_DATA_DIR:-$HOME/Library/Application Support/local-agent-lab/observability}"
export FIRST_LLM_WORKSPACE_ROOT="${FIRST_LLM_WORKSPACE_ROOT:-$ROOT}"
NODE_RUNTIME_FLAGS=()
if [[ -n "${HTTP_PROXY:-}${HTTPS_PROXY:-}${ALL_PROXY:-}" ]]; then
  NODE_RUNTIME_FLAGS+=(--use-env-proxy)
fi

case "$COMMAND" in
  dev)
    export NEXT_DIST_DIR="${NEXT_DIST_DIR:-$NEXT_DEV_DIST_DIR}"
    exec "$NODE_BIN" "${NODE_RUNTIME_FLAGS[@]}" node_modules/next/dist/bin/next dev -H "$WEB_HOST" -p "$PORT"
    ;;
  build)
    export NEXT_DIST_DIR="${NEXT_DIST_DIR:-$NEXT_BUILD_DIST_DIR}"
    exec "$NODE_BIN" "${NODE_RUNTIME_FLAGS[@]}" node_modules/next/dist/bin/next build
    ;;
  start)
    export NEXT_DIST_DIR="${NEXT_DIST_DIR:-$NEXT_BUILD_DIST_DIR}"
    STANDALONE_DIR="$ROOT/$NEXT_DIST_DIR/standalone"
    if [[ ! -f "$STANDALONE_DIR/server.js" ]]; then
      echo "Standalone build is missing. Run npm run build before npm run start." >&2
      exit 1
    fi
    mkdir -p "$STANDALONE_DIR/$NEXT_DIST_DIR/static"
    cp -R "$ROOT/$NEXT_DIST_DIR/static/." "$STANDALONE_DIR/$NEXT_DIST_DIR/static/"
    if [[ -d "$ROOT/public" ]]; then
      mkdir -p "$STANDALONE_DIR/public"
      cp -R "$ROOT/public/." "$STANDALONE_DIR/public/"
    fi
    export HOSTNAME="$WEB_HOST"
    export PORT
    exec "$NODE_BIN" "${NODE_RUNTIME_FLAGS[@]}" "$STANDALONE_DIR/server.js"
    ;;
  *)
    echo "usage: $0 {dev|build|start} [port]" >&2
    exit 2
    ;;
esac
