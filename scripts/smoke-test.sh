#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-http://localhost:3011}"
CURL_MAX_TIME="${SMOKE_CURL_MAX_TIME:-20}"
FAILURES=0

check_http_200() {
  local label="$1"
  local url="$2"
  local code
  code="$(curl --max-time "$CURL_MAX_TIME" -s -o /dev/null -w "%{http_code}" "$url" || true)"
  if [[ "$code" == "200" ]]; then
    echo "[ok] $label -> $code"
  else
    echo "[fail] $label -> $code"
    FAILURES=$((FAILURES + 1))
  fi
}

check_json_field() {
  local label="$1"
  local url="$2"
  local js="$3"
  local body
  body="$(curl --max-time "$CURL_MAX_TIME" -fsS "$url" || true)"
  if [[ -z "$body" ]]; then
    echo "[fail] $label -> empty response"
    FAILURES=$((FAILURES + 1))
    return
  fi
  if printf "%s" "$body" | node -e "const fs=require('fs'); const input=fs.readFileSync(0,'utf8'); const data=JSON.parse(input); if (!(${js})) process.exit(1);" ; then
    echo "[ok] $label"
  else
    echo "[fail] $label"
    FAILURES=$((FAILURES + 1))
  fi
}

check_deprecated_route() {
  local label="$1"
  local url="$2"
  local successor="$3"
  local headers
  headers="$(curl --max-time "$CURL_MAX_TIME" -fsS -D - -o /dev/null "$url" || true)"
  if printf "%s" "$headers" | grep -qi '^deprecation: true' && printf "%s" "$headers" | grep -Fqi "<$successor>; rel=\"successor-version\""; then
    echo "[ok] $label compatibility headers"
  else
    echo "[fail] $label compatibility headers"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "== UI =="
check_http_200 "Agent" "$BASE_URL/agent"
check_http_200 "Compare" "$BASE_URL/compare"
check_http_200 "Fine-tune" "$BASE_URL/fine-tune"
check_http_200 "Models" "$BASE_URL/models"
check_http_200 "Benchmarks" "$BASE_URL/benchmarks"
check_http_200 "Retrieval" "$BASE_URL/retrieval"
check_http_200 "Experiments" "$BASE_URL/experiments"
check_http_200 "Admin" "$BASE_URL/admin"

echo
echo "== Agent APIs =="
check_json_field "Sessions route" "$BASE_URL/api/agent/sessions" "Array.isArray(data.sessions)"
check_json_field "Local 0.6B runtime" "$BASE_URL/api/agent/runtime?targetId=local-qwen3-0.6b" "data.targetId==='local-qwen3-0.6b'"
check_json_field "Local 4B runtime" "$BASE_URL/api/agent/runtime?targetId=local-qwen3-4b-4bit" "data.targetId==='local-qwen3-4b-4bit'"
check_json_field "Local Qwen3.5 4B runtime" "$BASE_URL/api/agent/runtime?targetId=local-qwen35-4b-4bit" "data.targetId==='local-qwen35-4b-4bit'"
check_json_field "Remote runtime status" "$BASE_URL/api/agent/runtime?targetId=anthropic-claude" "data.targetId==='anthropic-claude' && data.execution==='remote' && data.phase==='remote' && typeof data.available==='boolean'"

echo
echo "== Admin APIs =="
check_json_field "Retrieval foreground snapshot" "$BASE_URL/api/retrieval" "data.ok===true && Array.isArray(data.documents) && Array.isArray(data.chunks) && data.stats && typeof data.stats.documentCount==='number'"
check_json_field "Experiments timeline" "$BASE_URL/api/experiments?limit=5" "data.ok===true && Array.isArray(data.events)"
check_json_field "Fine-tune summary contract" "$BASE_URL/api/finetune" "data.ok===true && data.summary && typeof data.summary.generatedAt==='string' && typeof data.summary.dataDir==='string' && ['localTargets','datasets','recipes','jobs','adapters','operations'].every((key)=>Array.isArray(data.summary[key]))"
check_json_field "Models discovery contract" "$BASE_URL/api/models/discovery" "data.ok===true && data.summary && typeof data.summary.generatedAt==='string' && typeof data.summary.query==='string' && typeof data.summary.installRoot==='string' && Array.isArray(data.summary.candidates) && Array.isArray(data.summary.jobs) && data.summary.hardware && typeof data.summary.hardware==='object'"
check_json_field "Models runtime operations contract" "$BASE_URL/api/models/runtime-operations?limit=5" "data.ok===true && data.operations && data.operations.contractVersion==='models.runtime-operations.v2' && Array.isArray(data.operations.capabilities) && data.operations.capabilities.includes('developer-api') && data.operations.registry && Array.isArray(data.operations.registry.profiles) && data.operations.idleUnload && data.operations.requestLogs && Array.isArray(data.operations.requestLogs.entries) && data.operations.developerApi && typeof data.operations.developerApi.chatCompletionsUrl==='string'"
check_json_field "Experiments release train contract" "$BASE_URL/api/experiments/release-train" "data.ok===true && data.activeVersion==='v0.5.0' && Array.isArray(data.milestones) && data.milestones.length===10 && data.milestones.every((item)=>typeof item.version==='string' && Array.isArray(item.scope) && Array.isArray(item.acceptance) && Array.isArray(item.evidence))"
check_json_field "Latest benchmark progress" "$BASE_URL/api/admin/benchmark/progress?latest=1" "typeof data === 'object'"
check_json_field "Dashboard summary" "$BASE_URL/api/admin/dashboard?targetId=anthropic-claude&windowMinutes=720" "typeof data.summary === 'object' && data.adminCompatibilityUsage && typeof data.adminCompatibilityUsage.totalHits==='number' && Array.isArray(data.adminCompatibilityUsage.routes) && Array.isArray(data.providerHealthDesk) && data.providerHealthDesk.every((row)=>row.retryPolicy && Array.isArray(row.retryPolicy.templates) && typeof row.retryPolicy.recommendedTemplateId==='string')"
check_json_field "Admin compatibility usage contract" "$BASE_URL/api/admin/compatibility-usage" "data.ok===true && data.summary && typeof data.summary.totalHits==='number' && Array.isArray(data.summary.routes)"
check_deprecated_route "Knowledge base Admin API" "$BASE_URL/api/admin/knowledge-base" "/api/retrieval"
check_deprecated_route "Fine-tune Admin API" "$BASE_URL/api/admin/finetune" "/api/finetune"
check_deprecated_route "Model discovery Admin API" "$BASE_URL/api/admin/model-discovery" "/api/models/discovery"
check_deprecated_route "Timeline Admin API" "$BASE_URL/api/admin/timeline" "/api/experiments"

if [[ "${SMOKE_RUN_REMOTE_BENCHMARK:-0}" == "1" ]]; then
  echo
  echo "== Optional remote benchmark smoke =="
  curl --max-time "$CURL_MAX_TIME" -fsS "$BASE_URL/api/admin/benchmark" \
    -H "Content-Type: application/json" \
    -d '{
      "benchmarkMode":"prompt",
      "prompt":"请用一句话概括本地 Agent 工作台的价值。",
      "runs":1,
      "contextWindow":8192,
      "targetIds":["openai-gpt-5.4"],
      "providerProfile":"balanced",
      "thinkingMode":"standard"
    }' >/tmp/local-agent-smoke-benchmark.json
  check_json_field "Remote benchmark smoke" "file:///tmp/local-agent-smoke-benchmark.json" "Array.isArray(data.results) && data.results.length>0"
fi

echo
if [[ "$FAILURES" -gt 0 ]]; then
  echo "Smoke test finished with $FAILURES failure(s)."
  exit 1
fi

echo "Smoke test passed."
