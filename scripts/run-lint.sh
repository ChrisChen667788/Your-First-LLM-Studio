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

if [[ -z "$NODE_BIN" ]]; then
  if [[ -x "$PRIMARY_NODE" ]]; then
    NODE_BIN="$PRIMARY_NODE"
  elif [[ -n "$CURRENT_NODE" ]] && [[ "$(node_major_version "$CURRENT_NODE")" == "22" ]]; then
    NODE_BIN="$CURRENT_NODE"
  else
    echo "[lint] Node 22 binary not found. Install node@22 or set NODE22_BIN." >&2
    exit 1
  fi
fi

cd "$ROOT"
export PATH="$(dirname "$NODE_BIN"):$PATH"
export NODE="$NODE_BIN"
export npm_node_execpath="$NODE_BIN"
export NODE_BINARY="$NODE_BIN"
export NEXT_TELEMETRY_DISABLED=1
export NEXT_DIST_DIR="${NEXT_DIST_DIR:-.next-dev}"

printf '[lint] using %s at %s\n' "$($NODE_BIN -v)" "$NODE_BIN"
printf '[lint] checking source hygiene...\n'
"$NODE_BIN" scripts/source-hygiene.mjs
printf '[lint] running TypeScript no-emit check...\n'
"$NODE_BIN" node_modules/typescript/bin/tsc --noEmit

if [[ "${RUN_NEXT_LINT:-0}" == "1" ]]; then
  printf '[lint] RUN_NEXT_LINT=1, running Next ESLint with a visible heartbeat...\n'
  "$NODE_BIN" node_modules/next/dist/bin/next lint --dir app --dir components --dir lib --dir pages &
  lint_pid=$!
  while kill -0 "$lint_pid" 2>/dev/null; do
    sleep 10
    if kill -0 "$lint_pid" 2>/dev/null; then
      printf '[lint] Next ESLint still running...\n'
    fi
  done
  wait "$lint_pid"
fi

printf '[lint] completed.\n'
