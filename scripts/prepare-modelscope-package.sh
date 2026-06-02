#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/dist/modelscope-first-llm-studio"
TREEISH="${MODELSCOPE_TREEISH:-HEAD}"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

git -C "$ROOT_DIR" archive --format=tar "$TREEISH" | tar -x -C "$OUT_DIR"

echo "Prepared ModelScope package from $TREEISH: $OUT_DIR"
