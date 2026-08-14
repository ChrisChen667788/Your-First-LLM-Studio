#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${FIRST_LLM_EVALUATOR_BOOTSTRAP_PYTHON:-python3.11}"
EVALUATOR_VERSION="0.9.0"
EVALUATOR_DIR="${FIRST_LLM_MATH_VERIFY_HOME:-$HOME/Library/Application Support/local-agent-lab/evaluators/math-verify-$EVALUATOR_VERSION}"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Missing $PYTHON_BIN. Install Python 3.11 or set FIRST_LLM_EVALUATOR_BOOTSTRAP_PYTHON." >&2
  exit 1
fi

if [[ ! -x "$EVALUATOR_DIR/bin/python" ]]; then
  "$PYTHON_BIN" -m venv "$EVALUATOR_DIR"
fi

"$EVALUATOR_DIR/bin/python" -m pip install \
  --disable-pip-version-check \
  "math-verify==$EVALUATOR_VERSION" \
  "latex2sympy2_extended==1.11.0" \
  "antlr4-python3-runtime==4.13.2" \
  "sympy==1.14.0"

"$EVALUATOR_DIR/bin/python" scripts/math_verify_worker.py --health
echo "Math-Verify evaluator ready: $EVALUATOR_DIR"
