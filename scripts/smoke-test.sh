#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-http://localhost:3011}"
CURL_MAX_TIME="${SMOKE_CURL_MAX_TIME:-30}"
FAILURES=0
SMOKE_EVENTS_FILE="$(mktemp)"
SMOKE_REPORT_PATH="${SMOKE_REPORT_PATH:-$ROOT_DIR/output/release-smoke/route-smoke-latest.json}"
SMOKE_HISTORY_DIR="${SMOKE_HISTORY_DIR:-$ROOT_DIR/output/release-smoke/history}"

record_event() {
  local kind="$1"
  local label="$2"
  local status="$3"
  local detail="$4"
  printf "%s\t%s\t%s\t%s\n" "$kind" "$label" "$status" "$detail" >> "$SMOKE_EVENTS_FILE"
}

check_http_200() {
  local label="$1"
  local url="$2"
  local code
  code="$(curl --max-time "$CURL_MAX_TIME" -s -o /dev/null -w "%{http_code}" "$url" || true)"
  if [[ "$code" == "200" ]]; then
    echo "[ok] $label -> $code"
    record_event "ui" "$label" "pass" "$url"
  else
    echo "[fail] $label -> $code"
    record_event "ui" "$label" "fail" "$url status=$code"
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
    record_event "api" "$label" "fail" "$url empty-response"
    FAILURES=$((FAILURES + 1))
    return
  fi
  if printf "%s" "$body" | node -e "const fs=require('fs'); const input=fs.readFileSync(0,'utf8'); const data=JSON.parse(input); if (!(${js})) process.exit(1);" ; then
    echo "[ok] $label"
    record_event "api" "$label" "pass" "$url"
  else
    echo "[fail] $label"
    record_event "api" "$label" "fail" "$url contract-mismatch"
    FAILURES=$((FAILURES + 1))
  fi
}

check_json_stable_field() {
  local label="$1"
  local url="$2"
  local field="$3"
  local first
  local second
  first="$(curl --max-time "$CURL_MAX_TIME" -fsS "$url" | node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(0,'utf8')); process.stdout.write(String(data[process.argv[1]] || ''));" "$field" || true)"
  second="$(curl --max-time "$CURL_MAX_TIME" -fsS "$url" | node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(0,'utf8')); process.stdout.write(String(data[process.argv[1]] || ''));" "$field" || true)"
  if [[ -n "$first" && "$first" == "$second" ]]; then
    echo "[ok] $label"
    record_event "api" "$label" "pass" "$url field=$field"
  else
    echo "[fail] $label"
    record_event "api" "$label" "fail" "$url unstable-field=$field"
    FAILURES=$((FAILURES + 1))
  fi
}

check_text_contains() {
  local label="$1"
  local url="$2"
  local expected="$3"
  local body
  body="$(curl --max-time "$CURL_MAX_TIME" -fsS "$url" || true)"
  if [[ "$body" == *"$expected"* ]]; then
    echo "[ok] $label"
    record_event "api" "$label" "pass" "$url"
  else
    echo "[fail] $label"
    record_event "api" "$label" "fail" "$url missing=$expected"
    FAILURES=$((FAILURES + 1))
  fi
}

check_json_post_status() {
  local label="$1"
  local url="$2"
  local request_body="$3"
  local expected_status="$4"
  local js="$5"
  local response_file
  response_file="$(mktemp)"
  local code
  code="$(curl --max-time "$CURL_MAX_TIME" -sS -o "$response_file" -w "%{http_code}" "$url" -H "Content-Type: application/json" -H "X-First-LLM-Operator-Key: ${FIRST_LLM_OPERATOR_TOKEN:-}" -d "$request_body" || true)"
  if [[ "$code" == "$expected_status" ]] && node - "$response_file" "$js" <<'NODE'
const fs = require("fs");
const [file, expression] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(file, "utf8"));
if (!Function("data", `return (${expression});`)(data)) process.exit(1);
NODE
  then
    echo "[ok] $label"
    record_event "api" "$label" "pass" "$url status=$code"
  else
    echo "[fail] $label -> $code"
    record_event "api" "$label" "fail" "$url status=$code"
    FAILURES=$((FAILURES + 1))
  fi
  rm -f "$response_file"
}

issue_workflow_deployment_key() {
  local response_file
  response_file="$(mktemp)"
  local code
  code="$(curl --max-time "$CURL_MAX_TIME" -sS -o "$response_file" -w "%{http_code}" "$BASE_URL/api/workflows/deployment-access" -H "Content-Type: application/json" -H "X-First-LLM-Operator-Key: ${FIRST_LLM_OPERATOR_TOKEN:-}" -d '{"action":"issue","workflowSlug":"retrieval-grounded-answer","version":1,"scopes":["invoke"],"ttlMinutes":10}' || true)"
  WORKFLOW_API_KEY="$(node - "$response_file" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
try {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (data.ok === true && typeof data.token === "string") process.stdout.write(data.token);
} catch {}
NODE
)"
  if [[ "$code" == "201" && -n "$WORKFLOW_API_KEY" ]]; then
    echo "[ok] Workflow deployment key issuance"
    record_event "api" "Workflow deployment key issuance" "pass" "$BASE_URL/api/workflows/deployment-access status=$code"
  else
    echo "[fail] Workflow deployment key issuance -> $code"
    record_event "api" "Workflow deployment key issuance" "fail" "$BASE_URL/api/workflows/deployment-access status=$code"
    FAILURES=$((FAILURES + 1))
  fi
  rm -f "$response_file"
}

check_workflow_completion() {
  local response_file
  response_file="$(mktemp)"
  local code
  code="$(curl --max-time "$CURL_MAX_TIME" -sS -o "$response_file" -w "%{http_code}" "$BASE_URL/api/workflows/deploy/retrieval-grounded-answer/v1/chat/completions" -H "Authorization: Bearer $WORKFLOW_API_KEY" -H "Content-Type: application/json" -d '{"model":"workflow:retrieval-grounded-answer","messages":[{"role":"user","content":"Route smoke workflow invocation."}]}' || true)"
  if [[ "$code" == "200" ]] && node - "$response_file" <<'NODE'
const fs = require("fs");
const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (!(data.object === "chat.completion" && data.choices?.[0]?.finish_reason === "stop" && data.choices?.[0]?.message?.role === "assistant" && data.usage?.total_tokens > 0 && data.workflow?.status === "completed")) process.exit(1);
NODE
  then
    echo "[ok] Workflow OpenAI-compatible completion"
    record_event "api" "Workflow OpenAI-compatible completion" "pass" "$BASE_URL/api/workflows/deploy/retrieval-grounded-answer/v1/chat/completions status=$code"
  elif [[ "$code" == "409" ]] && node - "$response_file" <<'NODE'
const fs = require("fs");
const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (!(data.error?.code === "workflow_requires_resume" && typeof data.workflow?.executionId === "string" && typeof data.workflow?.resumeReason === "string")) process.exit(1);
NODE
  then
    echo "[ok] Workflow OpenAI-compatible durable boundary"
    record_event "api" "Workflow OpenAI-compatible completion" "pass" "$BASE_URL/api/workflows/deploy/retrieval-grounded-answer/v1/chat/completions status=$code durable-boundary"
  else
    echo "[fail] Workflow OpenAI-compatible completion -> $code"
    record_event "api" "Workflow OpenAI-compatible completion" "fail" "$BASE_URL/api/workflows/deploy/retrieval-grounded-answer/v1/chat/completions status=$code"
    FAILURES=$((FAILURES + 1))
  fi
  rm -f "$response_file"
}

check_workflow_stream() {
  local response_file
  response_file="$(mktemp)"
  local code
  code="$(curl --max-time "$CURL_MAX_TIME" -sS -o "$response_file" -w "%{http_code}" "$BASE_URL/api/workflows/deploy/retrieval-grounded-answer/v1/chat/completions" -H "Authorization: Bearer $WORKFLOW_API_KEY" -H "Content-Type: application/json" -d '{"model":"workflow:retrieval-grounded-answer","messages":[{"role":"user","content":"Stream this workflow."}],"stream":true,"stream_options":{"include_usage":true}}' || true)"
  local body
  body="$(cat "$response_file")"
  if [[ "$code" == "200" && "$body" == *'"object":"chat.completion.chunk"'* && "$body" == *'"finish_reason":"stop"'* && "$body" == *'data: [DONE]'* ]]; then
    echo "[ok] Workflow OpenAI-compatible SSE"
    record_event "api" "Workflow OpenAI-compatible SSE" "pass" "$BASE_URL/api/workflows/deploy/retrieval-grounded-answer/v1/chat/completions"
  elif [[ "$code" == "409" ]] && node - "$response_file" <<'NODE'
const fs = require("fs");
const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (!(data.error?.code === "workflow_requires_resume" && typeof data.workflow?.executionId === "string" && typeof data.workflow?.resumeReason === "string")) process.exit(1);
NODE
  then
    echo "[ok] Workflow OpenAI-compatible SSE durable boundary"
    record_event "api" "Workflow OpenAI-compatible SSE" "pass" "$BASE_URL/api/workflows/deploy/retrieval-grounded-answer/v1/chat/completions status=$code durable-boundary"
  else
    echo "[fail] Workflow OpenAI-compatible SSE"
    record_event "api" "Workflow OpenAI-compatible SSE" "fail" "$BASE_URL/api/workflows/deploy/retrieval-grounded-answer/v1/chat/completions contract-mismatch"
    FAILURES=$((FAILURES + 1))
  fi
  rm -f "$response_file"
}

check_deprecated_route() {
  local label="$1"
  local url="$2"
  local successor="$3"
  local headers
  headers="$(curl --max-time "$CURL_MAX_TIME" -fsS -D - -o /dev/null -H "X-First-LLM-Evidence-Source: route-smoke" "$url" || true)"
  if printf "%s" "$headers" | grep -qi '^deprecation: true' && printf "%s" "$headers" | grep -Fqi "<$successor>; rel=\"successor-version\""; then
    echo "[ok] $label compatibility headers"
    record_event "compatibility" "$label" "pass" "$url successor=$successor"
  else
    echo "[fail] $label compatibility headers"
    record_event "compatibility" "$label" "fail" "$url missing-compatibility-headers"
    FAILURES=$((FAILURES + 1))
  fi
}

write_smoke_report() {
  mkdir -p "$(dirname "$SMOKE_REPORT_PATH")"
  node - "$SMOKE_EVENTS_FILE" "$SMOKE_REPORT_PATH" "$BASE_URL" "$FAILURES" <<'NODE'
const fs = require("fs");
const crypto = require("crypto");
const [eventsPath, reportPath, baseUrl, failureCountRaw] = process.argv.slice(2);
const rows = fs.existsSync(eventsPath)
  ? fs.readFileSync(eventsPath, "utf8").trim().split(/\n/).filter(Boolean)
  : [];
const checks = rows.map((row) => {
  const [kind, label, status, detail] = row.split("\t");
  return { kind, label, status, detail };
});
const counts = (kind) => checks.filter((check) => check.kind === kind).length;
const passCounts = (kind) =>
  checks.filter((check) => check.kind === kind && check.status === "pass").length;
const failureCount = Number(failureCountRaw) || 0;
const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
const reportPayload = {
  schemaVersion: "first-llm-studio.route-smoke.v1",
  generatedAt: new Date().toISOString(),
  baseUrl,
  status: failureCount === 0 ? "pass" : "fail",
  totals: {
    checkCount: checks.length,
    passCount: checks.filter((check) => check.status === "pass").length,
    failureCount,
    uiRouteCount: counts("ui"),
    uiRoutePassCount: passCounts("ui"),
    apiContractCount: counts("api"),
    apiContractPassCount: passCounts("api"),
    compatibilityHeaderCount: counts("compatibility"),
    compatibilityHeaderPassCount: passCounts("compatibility"),
  },
  checks,
};
const report = {
  ...reportPayload,
  integrity: {
    algorithm: "sha256",
    digest: crypto.createHash("sha256").update(stableStringify(reportPayload)).digest("hex"),
    verified: true,
  },
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
NODE
  mkdir -p "$SMOKE_HISTORY_DIR"
  local archive_timestamp
  archive_timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  cp "$SMOKE_REPORT_PATH" "$SMOKE_HISTORY_DIR/route-smoke-$archive_timestamp.json"
  rm -f "$SMOKE_EVENTS_FILE"
}

echo "== UI =="
check_http_200 "Agent" "$BASE_URL/agent"
check_http_200 "Compare" "$BASE_URL/compare"
check_http_200 "Fine-tune" "$BASE_URL/fine-tune"
check_http_200 "Models" "$BASE_URL/models"
check_http_200 "Benchmarks" "$BASE_URL/benchmarks"
check_http_200 "Retrieval" "$BASE_URL/retrieval"
check_http_200 "Experiments" "$BASE_URL/experiments"
check_http_200 "Workflows" "$BASE_URL/workflows"
check_http_200 "Release" "$BASE_URL/release"
check_http_200 "Admin" "$BASE_URL/admin"

echo
echo "== Agent APIs =="
check_json_field "Sessions route" "$BASE_URL/api/agent/sessions" "Array.isArray(data.sessions)"
check_json_field "Local 0.6B runtime" "$BASE_URL/api/agent/runtime?targetId=local-qwen3-0.6b" "data.targetId==='local-qwen3-0.6b'"
check_json_field "Local 4B runtime" "$BASE_URL/api/agent/runtime?targetId=local-qwen3-4b-4bit" "data.targetId==='local-qwen3-4b-4bit'"
check_json_field "Local Qwen3.5 4B runtime" "$BASE_URL/api/agent/runtime?targetId=local-qwen35-4b-4bit" "data.targetId==='local-qwen35-4b-4bit'"
check_json_field "Remote runtime status" "$BASE_URL/api/agent/runtime?targetId=anthropic-claude" "data.targetId==='anthropic-claude' && data.execution==='remote' && data.phase==='remote' && typeof data.available==='boolean'"
check_json_field "Agent workspace file application" "$BASE_URL/api/agent/workspace-file?path=package.json" "data.ok===true && data.path==='package.json' && typeof data.content==='string' && typeof data.truncated==='boolean'"
check_json_field "Agent check history application" "$BASE_URL/api/agent/check-history?limit=5" "Array.isArray(data.logs) && typeof data.count==='number' && data.paths && typeof data.paths==='object'"
check_json_post_status "Agent tool decision validation" "$BASE_URL/api/agent/tool/decision" '{}' '400' "typeof data.error==='string' && data.error.includes('targetId')"
check_json_field "Canonical Compare recipe route" "$BASE_URL/api/compare/recipes" "data.ok===true && Array.isArray(data.recipes)"

echo
echo "== Admin APIs =="
check_json_field "Retrieval foreground snapshot" "$BASE_URL/api/retrieval" "data.ok===true && Array.isArray(data.documents) && Array.isArray(data.chunks) && data.stats && typeof data.stats.documentCount==='number'"
check_json_field "Retrieval query replay contract" "$BASE_URL/api/retrieval/query?limit=5" "data.ok===true && data.schemaVersion==='retrieval.query-replay.v1' && Array.isArray(data.entries) && data.totals && typeof data.totals.entryCount==='number' && typeof data.totals.diagnosticLabelCount==='number'"
check_json_field "Experiments timeline" "$BASE_URL/api/experiments?limit=5" "data.ok===true && Array.isArray(data.events)"
check_json_field "Fine-tune summary contract" "$BASE_URL/api/finetune" "data.ok===true && data.summary && typeof data.summary.generatedAt==='string' && typeof data.summary.dataDir==='string' && ['localTargets','datasets','recipes','jobs','adapters','operations'].every((key)=>Array.isArray(data.summary[key]))"
check_json_field "Models discovery contract" "$BASE_URL/api/models/discovery" "data.ok===true && data.summary && typeof data.summary.generatedAt==='string' && typeof data.summary.query==='string' && typeof data.summary.installRoot==='string' && Array.isArray(data.summary.candidates) && Array.isArray(data.summary.jobs) && data.summary.hardware && typeof data.summary.hardware==='object'"
check_json_field "Models runtime operations contract" "$BASE_URL/api/models/runtime-operations?limit=5" "data.ok===true && data.operations && data.operations.contractVersion==='models.runtime-operations.v2' && Array.isArray(data.operations.capabilities) && data.operations.capabilities.includes('developer-api') && data.operations.capabilities.includes('server-actions') && data.operations.registry && Array.isArray(data.operations.registry.profiles) && data.operations.idleUnload && data.operations.requestLogs && Array.isArray(data.operations.requestLogs.entries) && data.operations.developerApi && typeof data.operations.developerApi.chatCompletionsUrl==='string' && Array.isArray(data.operations.targetCards) && data.operations.targetCards.every((card)=>typeof card.targetId==='string' && typeof card.chatCompletionsUrl==='string' && typeof card.profileCount==='number' && typeof card.requestCount==='number' && Array.isArray(card.serverActions))"
check_json_field "Desktop first-run readiness contract" "$BASE_URL/api/desktop/readiness" "data.ok===true && data.schemaVersion==='desktop.first-run-readiness.v1' && Array.isArray(data.checks) && data.checks.length>=5 && data.totals && typeof data.totals.blocked==='number'"
check_json_field "Desktop package rehearsal contract" "$BASE_URL/api/desktop/package-rehearsal" "data.ok===true && data.schemaVersion==='desktop.package-rehearsal.v1' && data.signerMode==='local-ed25519-rehearsal' && data.developerId && typeof data.developerId.verified==='boolean' && Array.isArray(data.reports)"
check_json_field "Apple release signing readiness" "$BASE_URL/api/desktop/apple-release-signing" "data.ok===true && data.schemaVersion==='desktop.apple-release-signing.v2' && typeof data.preflightReady==='boolean' && typeof data.completed==='boolean' && data.tools && typeof data.tools.notarytool==='boolean' && Array.isArray(data.blockers) && Array.isArray(data.completionBlockers)"
check_json_field "Desktop external acceptance readiness" "$BASE_URL/api/desktop/external-acceptance" "data.ok===true && data.schemaVersion==='desktop.external-acceptance.v1' && typeof data.ready==='boolean' && data.checks && typeof data.checks.signatureVerified==='boolean' && Array.isArray(data.blockers) && data.paths && typeof data.paths.trust==='string'"
check_json_field "Desktop update channel evidence" "$BASE_URL/api/desktop/update-channel" "data.ok===true && data.schemaVersion==='desktop.update-channel.v1' && Array.isArray(data.receipts) && data.latestPassing && data.latestPassing.rollbackVerified===true"
check_json_field "Desktop data lifecycle evidence" "$BASE_URL/api/desktop/data-lifecycle" "data.ok===true && data.schemaVersion==='desktop.data-lifecycle.v1' && Array.isArray(data.receipts) && data.latestPassing && data.latestPassing.checks.uninstallPreservesData===true && data.latestPassing.checks.explicitPurgeRemovesData===true"
check_json_field "Desktop service supervisor evidence" "$BASE_URL/api/desktop/service-supervisor" "data.ok===true && data.schemaVersion==='desktop.service-supervisor.v1' && Array.isArray(data.services) && data.latestPassing && data.latestPassing.checks.recoveryIncrementsGeneration===true"
check_json_field "Desktop permission repair evidence" "$BASE_URL/api/desktop/permission-repair" "data.ok===true && data.schemaVersion==='desktop.permission-repair.v1' && data.latestPassing && data.latestPassing.checks.contentDigestPreserved===true && data.latestPassing.checks.symlinkEscapeDenied===true"
check_json_field "Desktop v1.1 onboarding release contract" "$BASE_URL/api/desktop/onboarding-release" "data.ok===true && data.schemaVersion==='desktop.onboarding-release.v1' && data.version==='1.1.0-rc.2' && typeof data.localRcReady==='boolean' && typeof data.gaReady==='boolean' && Array.isArray(data.steps) && data.steps.length>=10 && data.totals && Array.isArray(data.gaBlockers) && data.externalAcceptance && data.paths && typeof data.paths.releaseManifest==='string'"
check_json_field "Model acquisition registry contract" "$BASE_URL/api/models/acquisitions" "data.ok===true && data.schemaVersion==='models.acquisition-registry.v1' && Array.isArray(data.capabilities) && data.capabilities.includes('pause-resume-contract') && data.capabilities.includes('bounded-range-transfer') && Array.isArray(data.jobs) && data.totals && typeof data.totals.jobs==='number'"
check_json_field "Hub multi-file transfer contract" "$BASE_URL/api/models/hub-transfers" "data.ok===true && data.schemaVersion==='models.hub-transfer-session.v2' && Array.isArray(data.sessions) && Array.isArray(data.receipts) && Array.isArray(data.capabilities) && data.capabilities.includes('immutable-revision-resolution') && data.capabilities.includes('authenticated-identity-proof') && data.capabilities.includes('final-checksum-provenance-receipt') && data.providers && data.providers.huggingFace.automaticManifest===true && data.providers.modelScope.automaticManifest===true"
check_json_field "Model content-address index" "$BASE_URL/api/models/content-index" "data.ok===true && data.schemaVersion==='models.content-address-index.v1' && Array.isArray(data.objects) && data.totals && typeof data.totals.potentialSavingsBytes==='number'"
check_json_field "Model content deduplication evidence" "$BASE_URL/api/models/content-deduplication" "data.ok===true && data.schemaVersion==='models.content-deduplication.v1' && Array.isArray(data.receipts) && data.latestPassing && data.latestPassing.checks.atomicReplacementComplete===true"
check_json_field "Hub transfer reconciliation evidence" "$BASE_URL/api/models/hub-transfers/reconcile" "data.ok===true && data.schemaVersion==='models.hub-session-reconciliation.v1' && Array.isArray(data.receipts) && data.latestPassing && data.latestPassing.status==='pass'"
check_json_field "External storage migration evidence" "$BASE_URL/api/models/external-storage" "data.ok===true && data.schemaVersion==='models.external-storage-migration.v2' && data.mode==='plan-only' && data.requiresOperatorApproval===true && typeof data.destructiveApprovalPhrase==='string' && Array.isArray(data.receipts)"
check_json_field "Model Hub promotion evidence" "$BASE_URL/api/models/promotion-evidence" "data.ok===true && data.schemaVersion==='models.promotion-evidence.v1' && ['pass','hold'].includes(data.status) && data.checks && typeof data.checks.authenticatedHubReceipt==='boolean' && Array.isArray(data.blockers) && typeof data.evidenceDigest==='string' && data.evidenceDigest.length===64"
check_json_stable_field "Model Hub promotion evidence digest stability" "$BASE_URL/api/models/promotion-evidence" "evidenceDigest"
check_json_field "Model compatibility manifest" "$BASE_URL/api/models/compatibility" "data.ok===true && data.schemaVersion==='models.compatibility-manifest.v1' && Array.isArray(data.receipts) && data.latestPassing && data.latestPassing.checks.hardwareFits===true"
check_json_field "Model benchmark handoff" "$BASE_URL/api/models/benchmark-handoff" "data.ok===true && data.schemaVersion==='models.benchmark-handoff.v1' && Array.isArray(data.receipts) && data.latestReady && data.latestReady.compatibilityReceiptId"
check_json_field "Authenticated model source manifests" "$BASE_URL/api/models/source-manifests" "data.ok===true && data.schemaVersion==='models.source-manifest.v1' && data.security.tokenValuesPersisted===false && data.latestPassing && data.latestPassing.files.length>=2 && data.latestPassing.checks.immutableRevision===true"
check_json_field "Model transfer scheduler evidence" "$BASE_URL/api/models/transfer-scheduler" "data.ok===true && data.schemaVersion==='models.transfer-scheduler.v1' && data.latestPassing && data.latestPassing.checks.hostLimitRespected===true && data.latestPassing.checks.retryBackoffRespected===true"
check_json_field "Model removal lifecycle evidence" "$BASE_URL/api/models/removal-lifecycle" "data.ok===true && data.schemaVersion==='models.removal-lifecycle.v1' && data.latestPassing && data.latestPassing.checks.sharedBlobPreserved===true && data.latestPassing.checks.rollbackRestoresOwner===true"
check_json_field "Server instance registry contract" "$BASE_URL/api/models/server-instances" "data.ok===true && data.schemaVersion==='models.server-instance-registry.v1' && Array.isArray(data.instances) && data.instances.length>=1 && data.totals && data.totals.unauthenticatedLan===0"
check_json_field "Server request ledger contract" "$BASE_URL/api/models/server-instances/requests" "data.ok===true && data.schemaVersion==='models.server-request-ledger.v1' && Array.isArray(data.entries) && data.totals && typeof data.totals.averageLatencyMs==='number'"
check_json_field "Server lifecycle evidence" "$BASE_URL/api/models/server-instances/actions" "data.ok===true && data.schemaVersion==='models.server-lifecycle.v1' && Array.isArray(data.receipts) && data.latestPassing && data.registry && Array.isArray(data.registry.instances)"
check_json_field "Idle unload daemon evidence" "$BASE_URL/api/models/server-instances/idle-unload" "data.ok===true && data.schemaVersion==='models.idle-unload-daemon.v1' && Array.isArray(data.receipts) && data.latestPassing && data.latestPassing.mode==='dry-run'"
check_json_field "Server caller attribution evidence" "$BASE_URL/api/models/server-instances/access" "data.ok===true && data.schemaVersion==='models.server-access-control.v1' && Array.isArray(data.keys) && data.keys.every((entry)=>entry.digest===undefined) && data.latestPassing && data.latestPassing.checks.plaintextNotPersisted===true"
check_json_field "Server network policy evidence" "$BASE_URL/api/models/server-instances/network-policy" "data.ok===true && data.schemaVersion==='models.server-network-policy.v1' && Array.isArray(data.receipts) && data.latestPassing && data.latestPassing.decisions.every((entry)=>entry.matchedExpectation===true)"
check_json_field "Drain-aware server switch evidence" "$BASE_URL/api/models/server-instances/switch-controller" "data.ok===true && data.schemaVersion==='models.server-switch-controller.v1' && data.latestPassing && data.latestPassing.checks.drainsBeforeActivation===true && data.latestPassing.checks.unhealthyCandidateRollsBack===true"
check_json_field "Server log retention evidence" "$BASE_URL/api/models/server-instances/log-retention" "data.ok===true && data.schemaVersion==='models.server-log-retention.v1' && data.latestPassing && data.latestPassing.checks.callerKeyRedacted===true && data.latestPassing.expiredCount===1"
check_json_field "Real Local Server acceptance evidence" "$BASE_URL/api/models/local-server-acceptance" "data.ok===true && data.schemaVersion==='models.local-server-acceptance.v1' && Array.isArray(data.receipts) && Array.isArray(data.capabilities) && data.capabilities.includes('streaming-sse') && data.capabilities.includes('unload-reload-recovery')"
check_json_field "Local Server promotion evidence" "$BASE_URL/api/models/local-server-promotion" "data.ok===true && data.schemaVersion==='models.local-server-promotion.v1' && ['pass','evidence-needed'].includes(data.localStatus) && data.productionStatus==='hold' && data.localChecks && Array.isArray(data.productionBlockers) && data.productionBlockers.length===2 && typeof data.evidenceDigest==='string' && data.evidenceDigest.length===64"
check_json_stable_field "Local Server promotion digest stability" "$BASE_URL/api/models/local-server-promotion" "evidenceDigest"
check_json_field "Runtime adapter conformance contract" "$BASE_URL/api/runtime/adapters" "data.ok===true && data.schemaVersion==='runtime.adapter-conformance.v2' && Array.isArray(data.adapters) && data.adapters.length===6 && data.totals.implemented===6 && data.totals.planned===0 && data.totals.conformant===6 && data.adapters.every((item)=>item.status==='implemented' && item.conformance==='pass')"
check_json_field "Runtime Fabric acceptance contract" "$BASE_URL/api/runtime/fabric-acceptance" "data.ok===true && data.schemaVersion==='runtime.fabric-acceptance.v1' && Array.isArray(data.receipts) && (data.latest===null || (Array.isArray(data.latest.backends) && data.latest.adapterContract.implemented===6))"
check_json_field "Runtime Fabric promotion contract" "$BASE_URL/api/runtime/fabric-promotion" "data.ok===true && data.schemaVersion==='runtime.fabric-promotion.v1' && ['pass','evidence-needed'].includes(data.localStatus) && data.productionStatus==='hold' && Array.isArray(data.productionBlockers) && data.productionBlockers.length===3 && typeof data.evidenceDigest==='string' && data.evidenceDigest.length===64"
check_json_stable_field "Runtime Fabric promotion digest stability" "$BASE_URL/api/runtime/fabric-promotion" "evidenceDigest"
check_json_field "Ollama runtime bridge contract" "$BASE_URL/api/runtime/ollama" "data.ok===true && data.schemaVersion==='runtime.ollama-bridge.v1' && typeof data.available==='boolean' && typeof data.baseUrl==='string' && (data.available===true || (data.error && typeof data.error.code==='string'))"
check_json_field "Ollama model conformance evidence" "$BASE_URL/api/runtime/ollama/conformance" "data.ok===true && data.schemaVersion==='runtime.ollama-conformance.v1' && Array.isArray(data.reports) && (data.latestPassing===null || data.latestPassing.ok===true)"
check_json_field "OpenAI-compatible runtime conformance" "$BASE_URL/api/runtime/openai-conformance" "data.ok===true && data.schemaVersion==='runtime.openai-compatible-conformance.v1' && Array.isArray(data.reports) && (data.latestPassing===null || data.latestPassing.ok===true)"
check_json_field "Runtime fleet conformance evidence" "$BASE_URL/api/runtime/fleet-conformance" "data.ok===true && data.schemaVersion==='runtime.fleet-conformance.v1' && Array.isArray(data.snapshots) && data.latestPassing && data.latestPassing.status==='pass'"
check_json_field "Runtime operation port contract" "$BASE_URL/api/runtime/operation-port" "data.ok===true && data.schemaVersion==='runtime.operation-port.v2' && Array.isArray(data.contracts) && data.contracts.length===6 && data.latestPassing && data.latestPassing.checks.every((entry)=>entry.normalized===true)"
check_json_field "Remote node routing evidence" "$BASE_URL/api/runtime/remote-nodes" "data.ok===true && data.schemaVersion==='runtime.remote-node-registry.v1' && Array.isArray(data.nodes) && data.latestPassing && typeof data.latestPassing.selectedNodeId==='string'"
check_json_field "Remote node lease and fencing evidence" "$BASE_URL/api/runtime/remote-failover" "data.ok===true && data.schemaVersion==='runtime.remote-failover.v1' && data.latestPassing && data.latestPassing.checks.fencingGenerationAdvanced===true && data.latestPassing.checks.noSplitBrainSelection===true"
check_json_field "Extension trust registry contract" "$BASE_URL/api/extensions" "data.ok===true && data.schemaVersion==='extensions.registry.v1' && Array.isArray(data.packages) && data.packages.every((item)=>item.validation.valid===true) && data.policy.requireSignatureForCommunity===true && data.dependencyResolution && data.dependencyResolution.valid===true && Array.isArray(data.dependencyResolution.installOrder) && data.quarantine && Array.isArray(data.quarantine.records) && data.verificationReceipts && Array.isArray(data.verificationReceipts.receipts) && data.mcpRegistry && data.ecosystemAcceptance && data.promotion"
check_json_field "Extension process sandbox evidence" "$BASE_URL/api/extensions/sandbox" "data.ok===true && data.schemaVersion==='extensions.process-sandbox.v2' && data.capabilities && data.capabilities.nodePermissionModel===true && Array.isArray(data.receipts) && data.latestOsEnforcedPassing && data.latestOsEnforcedPassing.osEnforced===true"
check_json_field "MCP server registry contract" "$BASE_URL/api/extensions/mcp-servers" "data.ok===true && data.schemaVersion==='extensions.mcp-server-registry.v1' && Array.isArray(data.servers) && data.servers.some((server)=>server.id==='io.github.modelcontextprotocol/server-filesystem' && server.source.packageName==='@modelcontextprotocol/server-filesystem' && server.transport.kind==='stdio' && server.lastProbe && server.lastProbe.status==='pass')"
check_json_field "Extension ecosystem acceptance" "$BASE_URL/api/extensions/acceptance" "data.ok===true && data.schemaVersion==='extensions.ecosystem-acceptance.v1' && data.latestPassing && data.latestPassing.status==='pass' && data.latestPassing.security.osEnforced===true && data.latestPassing.mcp.tools>=10 && Object.values(data.latestPassing.checks).every(Boolean)"
check_json_field "Extension ecosystem promotion" "$BASE_URL/api/extensions/promotion" "data.ok===true && data.schemaVersion==='extensions.ecosystem-promotion.v1' && data.localStatus==='pass' && data.productionStatus==='hold' && Object.values(data.localChecks).every(Boolean) && Array.isArray(data.productionBlockers) && data.productionBlockers.length===4 && typeof data.evidenceDigest==='string' && data.evidenceDigest.length===64"
check_json_stable_field "Extension ecosystem promotion digest stability" "$BASE_URL/api/extensions/promotion" "evidenceDigest"
check_json_field "Extension install plan contract" "$BASE_URL/api/extensions/install-plan" "data.ok===true && data.schemaVersion==='extensions.install-plan.v1' && Array.isArray(data.plans) && data.totals && typeof data.totals.ready==='number'"
check_json_field "Extension installation lifecycle" "$BASE_URL/api/extensions/installations" "data.ok===true && data.schemaVersion==='extensions.install-transaction.v1' && Array.isArray(data.installations) && data.totals.active>=1 && data.totals.rollbacks>=1 && data.totals.updates>=1 && data.totals.enableDisableActions>=2"
check_json_field "Extension secret scope evidence" "$BASE_URL/api/extensions/secret-scope" "data.ok===true && data.schemaVersion==='extensions.secret-scope-policy.v1' && Array.isArray(data.receipts) && data.latestPassing && data.latestPassing.persistedSecretValues===false"
check_json_field "Extension permission grant evidence" "$BASE_URL/api/extensions/permission-grants" "data.ok===true && data.schemaVersion==='extensions.permission-grants.v1' && data.latestPassing && data.latestPassing.checks.unconfirmedDangerousGrantDenied===true && data.latestPassing.checks.revokedGrantDenied===true"
check_json_field "Extension quarantine review evidence" "$BASE_URL/api/extensions/quarantine-review" "data.ok===true && data.schemaVersion==='extensions.quarantine-review.v1' && data.latestPassing && data.latestPassing.checks.failedPackageReleaseDenied===true && data.totals.released>=1 && data.totals.rejected>=1"
check_json_field "Workflow graph contract" "$BASE_URL/api/workflows" "data.ok===true && data.schemaVersion==='workflows.graph.v1' && Array.isArray(data.graphs) && data.graphs.some((item)=>item.graph.id==='agent-protected-tool-resume' && item.validation.valid===true) && data.graphRegistry && Array.isArray(data.graphRegistry.records) && data.graphRegistry.totals.deployments>=1 && data.executionStore && Array.isArray(data.executionStore.executions) && data.breakpointStore && Array.isArray(data.breakpointStore.breakpoints)"
check_json_post_status "Retrieval workflow deployment setup" "$BASE_URL/api/workflows/retrieval-graph" '{}' "200" "data.ok===true && data.receipt && data.receipt.status==='pass'"
check_json_post_status "Workflow deployment access rehearsal" "$BASE_URL/api/workflows/deployment-access" '{}' "200" "data.ok===true && data.receipt && data.receipt.status==='pass'"
issue_workflow_deployment_key
check_json_field "Workflow deploy-as-API contract" "$BASE_URL/api/workflows/deploy/retrieval-grounded-answer" "data.ok===true && data.executionMode==='durable-step-worker' && data.graphDigest && data.openAICompatibleEndpoint.endsWith('/v1/chat/completions') && data.inputSchema && data.inputSchema.required.includes('input')"
check_json_post_status "Workflow deployment rejects missing key" "$BASE_URL/api/workflows/deploy/retrieval-grounded-answer/v1/chat/completions" '{"model":"workflow:retrieval-grounded-answer","messages":[{"role":"user","content":"This must not run without a key."}]}' "401" "data.error && data.error.type==='authentication_error' && data.error.code==='invalid_api_key'"
if [[ -n "${WORKFLOW_API_KEY:-}" ]]; then
  check_workflow_completion
  check_workflow_stream
fi
check_json_field "Workflow Studio promotion boundary" "$BASE_URL/api/workflows/promotion" "data.ok===true && data.schemaVersion==='workflows.studio-promotion.v1' && ['pass','evidence-needed'].includes(data.localStatus) && data.productionStatus==='blocked' && Array.isArray(data.productionBlockers)"
check_json_field "Workflow safe worker evidence" "$BASE_URL/api/workflows/worker" "data.ok===true && data.schemaVersion==='workflows.safe-worker.v1' && Array.isArray(data.receipts) && data.latestPassing && data.totals.completed>=1"
check_json_field "Workflow replay evidence" "$BASE_URL/api/workflows/replay" "data.ok===true && data.schemaVersion==='workflows.replay-fork.v1' && Array.isArray(data.receipts) && data.latestPassing && data.latestPassing.copiedSideEffects===false"
check_json_field "Workflow state diff evidence" "$BASE_URL/api/workflows/state-diff" "data.ok===true && data.schemaVersion==='workflows.state-diff.v1' && Array.isArray(data.receipts) && data.latestPassing && data.latestPassing.diff.eventsAtFork===0 && data.latestPassing.checks.breakpointPausedReplay===true"
check_json_field "Workflow debugger closure" "$BASE_URL/api/workflows/debugger-closure" "data.ok===true && data.schemaVersion==='workflows.debugger-closure.v1' && data.productionStatus==='hold' && ['pass','hold'].includes(data.localStatus) && data.cards && data.cards.input && data.cards.error && data.recovery && Array.isArray(data.trace)"
check_json_field "Artifact federation trust" "$BASE_URL/api/artifacts/federation-trust" "data.ok===true && data.schemaVersion==='artifacts.federation-trust.v1' && data.productionStatus==='hold' && ['pass','hold'].includes(data.localStatus) && data.checks && data.summary && Array.isArray(data.blockers)"
check_json_field "Model supply-chain operations" "$BASE_URL/api/models/supply-chain-operations" "data.ok===true && data.schemaVersion==='models.supply-chain-operations.v1' && data.productionStatus==='hold' && ['pass','hold'].includes(data.localStatus) && data.checks && data.summary && Array.isArray(data.blockers)"
check_json_field "Continuous RAG governance" "$BASE_URL/api/retrieval/governance" "data.ok===true && data.schemaVersion==='retrieval.rag-governance.v1' && data.productionStatus==='hold' && ['pass','hold'].includes(data.localStatus) && data.checks && data.summary && Array.isArray(data.blockers)"
check_json_field "Reproducible training recipes" "$BASE_URL/api/finetune/reproducible-recipes" "data.ok===true && data.schemaVersion==='finetune.reproducible-training-recipes.v1' && data.productionStatus==='hold' && ['pass','hold'].includes(data.localStatus) && data.checks && data.summary && Array.isArray(data.blockers)"
check_json_field "Quality policy and safety review" "$BASE_URL/api/evaluation/quality-policy-safety" "data.ok===true && data.schemaVersion==='evaluation.quality-policy-safety-review.v1' && data.productionStatus==='hold' && ['pass','hold'].includes(data.localStatus) && data.checks && data.summary && Array.isArray(data.blockers)"
check_json_field "Enterprise control-plane candidate" "$BASE_URL/api/deployment/enterprise-control-plane" "data.ok===true && data.schemaVersion==='deployment.enterprise-control-plane-candidate.v1' && data.productionStatus==='hold' && ['pass','hold'].includes(data.localStatus) && data.checks && data.summary && Array.isArray(data.blockers)"
check_json_field "Enterprise production GA gate" "$BASE_URL/api/experiments/enterprise-production-ga" "data.ok===true && data.schemaVersion==='experiments.enterprise-production-ga.v1' && data.productionStatus==='blocked' && data.externalStatus==='hold' && ['pass','hold'].includes(data.localStatus) && data.checks && data.checks.localPromotionDenied===true && data.externalGates && Array.isArray(data.blockers)"
check_json_field "Production evidence authority" "$BASE_URL/api/experiments/production-evidence-authority" "data.ok===true && data.schemaVersion==='experiments.production-evidence-authority.v1' && ['missing','invalid','verified'].includes(data.evidenceStatus) && data.authorizationStatus==='not-authorized' && data.productionStatus==='blocked' && data.checks && data.checks.localPromotionDenied===true && Array.isArray(data.blockers)"
check_json_field "Release authority decision ledger" "$BASE_URL/api/experiments/release-authority-decision" "data.ok===true && data.schemaVersion==='experiments.release-authority-decision-ledger.v1' && ['missing','invalid','approved','rejected'].includes(data.decisionStatus) && data.authorizationStatus==='not-authorized' && data.productionStatus==='blocked' && data.checks && data.checks.localPromotionDenied===true && Array.isArray(data.blockers)"
check_json_field "Production lifecycle closure" "$BASE_URL/api/experiments/production-lifecycle-closure" "data.ok===true && data.schemaVersion==='experiments.production-lifecycle-closure.v1' && data.productionStatus==='blocked' && data.stages && ['missing','invalid','verified'].includes(data.stages.transition.status) && ['missing','invalid','verified'].includes(data.stages.rollback.status) && ['missing','invalid','verified'].includes(data.stages.closure.status) && data.summary && data.summary.requiredStages===3 && Array.isArray(data.blockers)"
check_json_field "Retrieval workflow deployment" "$BASE_URL/api/workflows/retrieval-graph" "data.ok===true && data.schemaVersion==='workflows.retrieval-graph.v1' && data.graph && data.graph.id==='retrieval-grounded-answer' && data.latestPassing && data.latestPassing.checks.deploymentResolved===true"
check_json_field "Workflow deployment access evidence" "$BASE_URL/api/workflows/deployment-access" "data.ok===true && data.schemaVersion==='workflows.deployment-access.v1' && data.security.plaintextPersisted===false && data.latestPassing && data.latestPassing.checks.wrongVersionDenied===true && data.latestPassing.checks.revokedKeyDenied===true"
check_json_field "Workspace governance contract" "$BASE_URL/api/governance" "data.ok===true && data.schemaVersion==='governance.workspace-identity.v1' && ['preview-disabled','local-preview'].includes(data.mode) && Array.isArray(data.workspaces) && data.sampleDecision.allowed===true && data.database && data.database.schemaVersion==='governance.workspace-acl-database.v4' && data.database.localAccess.allowed===true && data.postgresRls && data.postgresRls.latestPassing && data.identityProvisioning && Array.isArray(data.identityProvisioning.blockers) && data.identityMapping && data.identityMapping.schemaVersion==='governance.identity-workspace-mapping.v1' && data.rehearsalEvidence && data.rehearsalEvidence.multiUserConflict && data.rehearsalEvidence.multiUserConflict.ok===true"
check_json_field "OIDC and SCIM readiness" "$BASE_URL/api/governance/identity" "data.ok===true && data.schemaVersion==='governance.identity-provisioning.v2' && typeof data.oidc.configured==='boolean' && typeof data.scim.configured==='boolean' && Array.isArray(data.blockers)"
check_json_field "Organization group mapping readiness" "$BASE_URL/api/governance/identity-mappings" "data.ok===true && data.schemaVersion==='governance.identity-workspace-mapping.v1' && data.mappingCounts && typeof data.mappingCounts.workspaceRoleMappings==='number' && data.enforcement.explicitGroupClaimRequired===true"
check_json_field "Governance policy simulator" "$BASE_URL/api/governance/policy-simulator" "data.ok===true && data.schemaVersion==='governance.policy-simulator.v1' && Array.isArray(data.receipts) && data.latestPassing && data.latestPassing.coverage.crossWorkspace===true"
check_json_field "Shared asset immutable audit" "$BASE_URL/api/governance/shared-assets" "data.ok===true && data.schemaVersion==='governance.shared-asset-audit.v1' && Array.isArray(data.assets) && data.latestPassing && data.integrity.chainVerified===true"
check_json_field "Governance access review evidence" "$BASE_URL/api/governance/access-reviews" "data.ok===true && data.schemaVersion==='governance.access-review.v1' && data.latestPassing && data.latestPassing.checks.selfApprovalDenied===true && data.latestPassing.checks.independentReviewerApproved===true"
check_json_field "Training capability registry contract" "$BASE_URL/api/finetune/training-capabilities?backend=mlx-lm&family=qwen&method=lora&bits=4&scheduler=cosine" "data.ok===true && data.schemaVersion==='finetune.training-capabilities.v1' && Array.isArray(data.backends) && data.compatibility && data.compatibility.supported===true"
check_json_field "Training execution plan adapter" "$BASE_URL/api/finetune/training-execution-plan" "data.ok===true && data.schemaVersion==='finetune.training-execution-plan.v1' && data.sample && data.sample.executable===true && data.sample.executionMode==='worker-ready' && data.preview && data.preview.executable===false && data.preview.executionMode==='preview-only' && data.policy.previewBackendsMayExecute===false"
check_json_field "Evaluation statistics gate contract" "$BASE_URL/api/evaluation/statistics" "data.ok===true && data.schemaVersion==='evaluation.statistics-gate.v1' && Array.isArray(data.methods) && Array.isArray(data.reports)"
check_json_field "Evaluation regression suite" "$BASE_URL/api/evaluation/regression-suite" "data.ok===true && data.schemaVersion==='evaluation.regression-suite.v1' && Array.isArray(data.receipts) && data.latestPassing && data.latestPassing.metrics.length>=2"
check_json_field "Evaluation sweep calibration" "$BASE_URL/api/evaluation/sweep-calibration" "data.ok===true && data.schemaVersion==='evaluation.sweep-calibration.v1' && Array.isArray(data.receipts) && data.latestPassing && data.latestPassing.judgeCalibration.agreementRate>=data.latestPassing.judgeCalibration.threshold"
check_json_field "Evaluation baseline promotion evidence" "$BASE_URL/api/evaluation/baseline-promotion" "data.ok===true && data.schemaVersion==='evaluation.baseline-promotion.v1' && data.latestPassing && data.latestPassing.status==='promoted' && data.latestPassing.checks.reproducibilityPinned===true"
check_json_field "Artifact package contract" "$BASE_URL/api/artifacts/packages" "data.ok===true && data.schemaVersion==='artifacts.package.v1' && Array.isArray(data.supportedKinds) && data.supportedKinds.length===7 && data.example.validation.valid===true && data.provenance && data.provenance.schemaVersion==='artifacts.provenance-gate.v1' && Array.isArray(data.provenance.receipts)"
check_json_field "Artifact local registry round-trip" "$BASE_URL/api/artifacts/registry" "data.ok===true && data.schemaVersion==='artifacts.local-registry.v1' && Array.isArray(data.records) && data.totals.verified>=1"
check_json_field "Artifact registry adapter plans" "$BASE_URL/api/artifacts/registry-adapters" "data.ok===true && data.schemaVersion==='artifacts.registry-adapters.v1' && Array.isArray(data.targets) && data.targets.length===4 && data.totals.preview===3 && data.policy.remoteRoundTripReceiptRequired===true && data.policy.previewAdaptersMayMutateRemote===false"
check_json_field "Artifact quality and billing linkage" "$BASE_URL/api/artifacts/quality-claims" "data.ok===true && data.schemaVersion==='artifacts.quality-billing-link.v2' && Array.isArray(data.receipts) && data.latest && ['pass','hold'].includes(data.latest.status) && data.latest.billing.differenceTokens===0 && data.productionStatus==='hold'"
check_json_field "Artifact install lifecycle evidence" "$BASE_URL/api/artifacts/install-lifecycle" "data.ok===true && data.schemaVersion==='artifacts.install-lifecycle.v1' && data.latestPassing && data.latestPassing.checks.rollbackActivatedPriorVersion===true && data.latestPassing.checks.activeUnpublishDenied===true"
check_json_field "Post-v1 foundation evidence contract" "$BASE_URL/api/experiments/post-v1-foundation" "data.ok===true && data.schemaVersion==='experiments.post-v1-foundation.v1' && Array.isArray(data.rounds) && data.rounds.length===10 && data.totals && data.totals.rounds===10 && data.rounds.some((item)=>item.version==='v1.5.1' && item.status==='blocked')"
check_json_field "Post-v1 15-slice closure contract" "$BASE_URL/api/experiments/post-v1-closure" "data.ok===true && data.schemaVersion==='experiments.post-v1-closure.v1' && Array.isArray(data.slices) && data.slices.length===15 && data.totals && data.totals.slices===15 && data.slices.some((item)=>item.id==='postgres-context') && data.slices.some((item)=>item.id==='artifact-provenance')"
check_json_field "Post-v1 hardening evidence" "$BASE_URL/api/experiments/post-v1-hardening" "data.ok===true && data.schemaVersion==='experiments.post-v1-hardening.v1' && Array.isArray(data.slices) && data.slices.length===15 && data.totals && data.totals.ready===15 && data.totals.partial===0"
check_json_field "Post-v1 product acceptance evidence" "$BASE_URL/api/experiments/post-v1-acceptance" "data.ok===true && data.schemaVersion==='experiments.post-v1-acceptance.v1' && Array.isArray(data.slices) && data.slices.length===15 && data.totals && data.totals.ready+data.totals.partial+data.totals.blocked===15 && data.slices.some((item)=>item.id==='quality-billing-link' && ['ready','partial'].includes(item.status))"
check_json_field "Post-v1 operational lifecycle evidence" "$BASE_URL/api/experiments/post-v1-lifecycle" "data.ok===true && data.schemaVersion==='experiments.post-v1-lifecycle.v1' && Array.isArray(data.slices) && data.slices.length===15 && data.totals && data.totals.ready===15 && data.totals.partial===0"
check_json_field "V1.6 feature ownership evidence" "$BASE_URL/api/experiments/v16-feature-ownership" "data.ok===true && data.schemaVersion==='experiments.v16-feature-ownership.v1' && data.productionStatus==='hold' && data.totals && data.totals.slices===15 && ['pass','hold','evidence-needed'].includes(data.localStatus)"
check_json_field "V1.6.1 application contract evidence" "$BASE_URL/api/experiments/v161-application-contracts" "data.ok===true && data.schemaVersion==='experiments.v161-application-contracts.v1' && data.productionStatus==='hold' && data.totals && data.totals.slices===15 && ['pass','hold','evidence-needed'].includes(data.localStatus)"
check_json_field "Benchmark qualification evidence" "$BASE_URL/api/benchmarks/qualification" "data.ok===true && data.schemaVersion==='benchmark.qualification.v1' && data.productionStatus==='hold' && data.totals && data.totals.checks===15 && ['pass','hold','evidence-needed'].includes(data.localStatus)"
check_json_field "V1.6.3 benchmark qualification evidence" "$BASE_URL/api/experiments/v163-benchmark-qualification" "data.ok===true && data.schemaVersion==='experiments.v163-benchmark-qualification.v1' && data.productionStatus==='hold' && data.totals && data.totals.slices===15 && ['pass','hold','evidence-needed'].includes(data.localStatus)"
check_json_field "Official benchmark full-run status" "$BASE_URL/api/benchmarks/official-runs" "data.ok===true && data.schemaVersion==='benchmark.official-run.v1' && data.productionStatus==='hold' && Array.isArray(data.recentProgress)"
check_json_field "V1.6.4 official evaluator evidence" "$BASE_URL/api/experiments/v164-official-evaluators" "data.ok===true && data.schemaVersion==='experiments.v164-official-evaluators.v1' && data.productionStatus==='hold' && data.mathRuntime && Array.isArray(data.protocols) && data.protocols.length===4"
check_json_field "V1.6.7 workflow execution closure" "$BASE_URL/api/experiments/v167-workflow-execution-closure" "data.ok===true && data.schemaVersion==='workflows.execution-closure.v1' && data.productionStatus==='hold' && data.capabilities && Array.isArray(data.capabilities.executors) && data.capabilities.executors.length===8"
check_json_field "V1.6.8 Fine-tune execution truth" "$BASE_URL/api/experiments/v168-finetune-execution-truth" "data.ok===true && data.schemaVersion==='finetune.execution-truth.v1' && data.productionStatus==='hold' && data.latest && data.latest.totals.passed===15"
check_json_field "V1.6.9 Fine-tune quality and export" "$BASE_URL/api/experiments/v169-finetune-quality-export" "data.ok===true && data.schemaVersion==='finetune.quality-export-acceptance.v1' && data.productionStatus==='hold' && ['pass','hold','evidence-needed'].includes(data.localStatus)"
check_json_field "V1.7.0 benchmark candidate and multimodal" "$BASE_URL/api/experiments/v170-benchmark-candidate-multimodal" "data.ok===true && data.schemaVersion==='experiments.v170-benchmark-candidate-multimodal.v1' && data.productionStatus==='hold' && ['pass','hold'].includes(data.localStatus) && ['pass','hold','evidence-needed'].includes(data.candidatePromotionStatus) && ['pass','hold'].includes(data.multimodalExecutionStatus) && data.totals.slices===15 && Array.isArray(data.multimodalProtocols) && data.multimodalProtocols.length===4"
check_json_field "V1.7.1-v1.9.0 source train" "$BASE_URL/api/experiments/v171-v190-source-train" "data.ok===true && data.schemaVersion==='experiments.v171-v190-source-train.v1' && data.productionStatus==='hold' && ['pass','hold'].includes(data.localStatus) && data.totals.versions===10 && data.totals.sourceContractsPassed===10 && Array.isArray(data.versions) && data.versions.length===10 && data.versions.every((item)=>item.sourceStatus==='pass' && item.externalStatus==='hold' && item.productionStatus==='hold')"
check_json_field "V1.10.2-v1.12.0 source train" "$BASE_URL/api/experiments/v1102-v1200-source-train" "data.ok===true && data.schemaVersion==='experiments.v1102-v1200-source-train.v1' && data.productionStatus==='hold' && ['pass','hold'].includes(data.localStatus) && data.totals.versions===10 && data.totals.sourceContractsPassed===10 && Array.isArray(data.versions) && data.versions.length===10 && data.versions.every((item)=>item.sourceStatus==='pass' && item.externalStatus==='hold' && item.productionStatus==='hold')"
check_json_field "V2.1.0-v2.1.9 post-GA operations train" "$BASE_URL/api/experiments/post-ga-operations-train" "data.ok===true && data.schemaVersion==='experiments.post-ga-operations-train.v1' && data.sourceStatus==='pass' && data.externalStatus==='hold' && data.productionStatus==='blocked' && data.summary && data.summary.requiredVersions===10 && Array.isArray(data.versions) && data.versions.length===10 && data.versions.every((item)=>['missing','invalid','verified'].includes(item.evidenceStatus) && item.checks.localProductionTransitionDenied===true)"
check_json_field "V2.2.0-v2.2.9 continuous assurance train" "$BASE_URL/api/experiments/continuous-assurance-train" "data.ok===true && data.schemaVersion==='experiments.continuous-assurance-train.v1' && data.sourceStatus==='pass' && data.externalStatus==='hold' && data.productionStatus==='blocked' && data.summary && data.summary.requiredVersions===10 && Array.isArray(data.versions) && data.versions.length===10 && data.versions.every((item)=>['missing','invalid','verified'].includes(item.evidenceStatus) && item.checks.localProductionTransitionDenied===true)"
check_json_field "V2.3.0-v2.3.4 assurance closure train" "$BASE_URL/api/experiments/assurance-closure-train" "data.ok===true && data.schemaVersion==='experiments.assurance-closure-train.v1' && data.sourceStatus==='pass' && data.externalStatus==='hold' && data.productionStatus==='blocked' && data.summary && data.summary.requiredVersions===5 && Array.isArray(data.versions) && data.versions.length===5 && data.versions.every((item)=>['missing','invalid','verified'].includes(item.evidenceStatus) && item.checks.localProductionTransitionDenied===true)"
check_json_field "V2.4.0-v2.4.9 AI operations intelligence" "$BASE_URL/api/experiments/ai-operations-intelligence" "data.ok===true && data.schemaVersion==='experiments.ai-operations-intelligence.v1' && data.sourceStatus==='pass' && ['pass','attention'].includes(data.localStatus) && data.externalStatus==='hold' && data.productionStatus==='blocked' && data.sourceSummary && data.sourceSummary.sourceOwnedSignals===9 && data.summary && data.summary.requiredVersions===10 && Array.isArray(data.versions) && data.versions.length===10 && data.versions.every((item)=>item.sourceSignal && ['pass','attention','unavailable','external-only'].includes(item.sourceSignal.status) && ['missing','invalid','verified'].includes(item.evidenceStatus) && item.checks.localProductionTransitionDenied===true)"
check_json_field "V2.5.0-v2.5.4 deployment lifecycle assurance" "$BASE_URL/api/experiments/deployment-lifecycle-assurance" "data.ok===true && data.schemaVersion==='experiments.deployment-lifecycle-assurance.v1' && data.sourceStatus==='pass' && ['pass','attention'].includes(data.localStatus) && data.externalStatus==='hold' && data.productionStatus==='blocked' && data.sourceSummary && data.sourceSummary.sourceOwnedSignals===4 && data.summary && data.summary.requiredVersions===5 && Array.isArray(data.versions) && data.versions.length===5 && data.versions.every((item)=>item.sourceSignal && ['pass','attention','unavailable','external-only'].includes(item.sourceSignal.status) && ['missing','invalid','verified'].includes(item.evidenceStatus) && item.checks.localProductionTransitionDenied===true)"
check_json_field "V2.6.0-v2.6.9 governed autonomy readiness" "$BASE_URL/api/experiments/governed-autonomy-readiness" "data.ok===true && data.schemaVersion==='experiments.governed-autonomy-readiness.v1' && data.sourceStatus==='pass' && ['pass','attention'].includes(data.localStatus) && data.externalStatus==='hold' && data.productionStatus==='blocked' && data.sourceSummary && data.sourceSummary.sourceOwnedSignals===9 && data.summary && data.summary.requiredVersions===10 && Array.isArray(data.versions) && data.versions.length===10 && data.versions.every((item)=>item.sourceSignal && ['pass','attention','unavailable','external-only'].includes(item.sourceSignal.status) && ['missing','invalid','verified'].includes(item.evidenceStatus) && item.checks.localProductionTransitionDenied===true)"
check_json_field "V2.7.0-v2.7.4 open ecosystem interoperability" "$BASE_URL/api/experiments/open-ecosystem-interoperability" "data.ok===true && data.schemaVersion==='experiments.open-ecosystem-interoperability.v1' && data.sourceStatus==='pass' && ['pass','attention'].includes(data.localStatus) && data.externalStatus==='hold' && data.productionStatus==='blocked' && data.sourceSummary && data.sourceSummary.sourceOwnedSignals===4 && data.summary && data.summary.requiredVersions===5 && Array.isArray(data.versions) && data.versions.length===5 && data.versions.every((item)=>item.sourceSignal && ['pass','attention','unavailable','external-only'].includes(item.sourceSignal.status) && ['missing','invalid','verified'].includes(item.evidenceStatus) && item.checks.localProductionTransitionDenied===true)"
check_json_field "V2.8.0-v2.8.9 operational remediation efficiency" "$BASE_URL/api/experiments/operational-remediation-efficiency" "data.ok===true && data.schemaVersion==='experiments.operational-remediation-efficiency.v1' && data.sourceStatus==='pass' && ['pass','attention'].includes(data.localStatus) && data.externalStatus==='hold' && data.productionStatus==='blocked' && data.sourceSummary && data.sourceSummary.sourceOwnedSignals===9 && data.summary && data.summary.requiredVersions===10 && Array.isArray(data.versions) && data.versions.length===10 && data.versions.every((item)=>item.sourceSignal && ['pass','attention','unavailable','external-only'].includes(item.sourceSignal.status) && ['missing','invalid','verified'].includes(item.evidenceStatus) && item.checks.localProductionTransitionDenied===true)"
check_json_field "V2.9.0-v2.9.4 sustainable operations upgrade" "$BASE_URL/api/experiments/sustainable-operations-upgrade" "data.ok===true && data.schemaVersion==='experiments.sustainable-operations-upgrade.v1' && data.sourceStatus==='pass' && ['pass','attention'].includes(data.localStatus) && data.externalStatus==='hold' && data.productionStatus==='blocked' && data.sourceSummary && data.sourceSummary.sourceOwnedSignals===4 && data.summary && data.summary.requiredVersions===5 && Array.isArray(data.versions) && data.versions.length===5 && data.versions.every((item)=>item.sourceSignal && ['pass','attention','unavailable','external-only'].includes(item.sourceSignal.status) && ['missing','invalid','verified'].includes(item.evidenceStatus) && item.checks.localProductionTransitionDenied===true)"
check_json_field "V1.10.2 runtime recovery and performance evidence" "$BASE_URL/api/models/runtime-recovery-performance" "data.ok===true && data.schemaVersion==='models.runtime-recovery-performance.v1' && data.productionStatus==='hold' && ['pass','hold'].includes(data.localStatus) && data.performance && ['comparable','baseline-needed','incomplete'].includes(data.performance.comparison.status) && Array.isArray(data.performance.receipts) && data.recovery && Array.isArray(data.recovery.checkpoints) && Array.isArray(data.recovery.observedOperations)"
check_json_field "V1.10.3 workspace action provenance" "$BASE_URL/api/governance/workspace-provenance?execution=local" "data.ok===true && data.schemaVersion==='governance.workspace-action-provenance.v1' && data.context && ['loopback-local','signed-identity-proxy'].includes(data.context.authMode) && data.action && data.action.executionLocality==='local' && ['loopback-local','signed-identity-proxy'].includes(data.action.dataBoundary) && data.audit && typeof data.audit.contextDigest==='string' && data.evidence && data.evidence.productionStatus==='hold'"
check_json_field "V1.10.4 Agent action trust and recovery" "$BASE_URL/api/agent/action-trust-recovery" "data.ok===true && data.schemaVersion==='agent.action-trust-recovery.v1' && data.productionStatus==='hold' && ['pass','hold'].includes(data.localStatus) && data.checks && typeof data.checks.protectedActionInterrupted==='boolean' && typeof data.checks.noDuplicateSideEffects==='boolean' && typeof data.checks.replayForkOmitsSideEffects==='boolean' && typeof data.checks.breakpointStateDiffPassed==='boolean' && data.summary && typeof data.summary.duplicateSideEffects==='number'"
check_json_field "Post-v1 ten-version promotion gate" "$BASE_URL/api/experiments/post-v1-promotion-gate" "data.ok===true && data.schemaVersion==='experiments.post-v1-promotion-gate.v1' && Array.isArray(data.versions) && data.versions.length===10 && data.totals.locallyReadyVersions>=8 && data.totals.productionReadyVersions===0 && data.versions.every((item)=>item.localCompletionPct>0 && Array.isArray(item.externalBlockers)) && data.versions.some((item)=>item.version==='v1.3.1' && item.status==='externally-blocked' && item.localReady===true && item.productionReady===false && item.externalBlockers.length>=3) && data.versions.some((item)=>item.version==='v1.5.0' && item.productionReady===false)"
check_json_field "Experiments release train contract" "$BASE_URL/api/experiments/release-train" "data.ok===true && data.activeVersion==='v1.5.1' && data.developmentVersion==='v1.7.0-v2.9.4 source and evidence trains' && Array.isArray(data.milestones) && data.milestones.length===125 && data.milestones.some((item)=>item.version==='v1.0.0' && item.status==='complete') && data.milestones.some((item)=>item.version==='v1.5.1' && item.status==='blocked') && data.milestones.some((item)=>item.version==='v1.6.7' && item.status==='complete') && data.milestones.some((item)=>item.version==='v1.6.8' && item.status==='complete') && data.milestones.some((item)=>item.version==='v1.6.9' && item.status==='complete') && data.milestones.some((item)=>item.version==='v1.7.0' && item.status==='active') && data.milestones.some((item)=>item.version==='v1.10.1' && item.status==='planned') && data.milestones.some((item)=>item.version==='v1.12.0' && item.status==='planned') && data.milestones.some((item)=>item.version==='v2.0.0' && item.status==='planned') && ['v2.0.1','v2.0.2','v2.0.3','v2.0.4','v2.0.5','v2.1.0','v2.1.1','v2.1.2','v2.1.3','v2.1.4','v2.1.5','v2.1.6','v2.1.7','v2.1.8','v2.1.9','v2.2.0','v2.2.1','v2.2.2','v2.2.3','v2.2.4','v2.2.5','v2.2.6','v2.2.7','v2.2.8','v2.2.9','v2.3.0','v2.3.1','v2.3.2','v2.3.3','v2.3.4','v2.4.0','v2.4.1','v2.4.2','v2.4.3','v2.4.4','v2.4.5','v2.4.6','v2.4.7','v2.4.8','v2.4.9','v2.5.0','v2.5.1','v2.5.2','v2.5.3','v2.5.4','v2.6.0','v2.6.1','v2.6.2','v2.6.3','v2.6.4','v2.6.5','v2.6.6','v2.6.7','v2.6.8','v2.6.9','v2.7.0','v2.7.1','v2.7.2','v2.7.3','v2.7.4','v2.8.0','v2.8.1','v2.8.2','v2.8.3','v2.8.4','v2.8.5','v2.8.6','v2.8.7','v2.8.8','v2.8.9','v2.9.0','v2.9.1','v2.9.2','v2.9.3','v2.9.4'].every((version)=>data.milestones.some((item)=>item.version===version && item.status==='evidence-needed')) && data.milestones.every((item)=>typeof item.version==='string' && Array.isArray(item.scope) && Array.isArray(item.acceptance) && Array.isArray(item.evidence))"
check_json_field "Experiments promotion gate contract" "$BASE_URL/api/experiments/promotion-gate" "data.ok===true && data.schemaVersion==='experiments.promotion-gate.v1' && data.activeVersion==='v1.5.1' && ['pass','watch','hold'].includes(data.overallStatus) && Array.isArray(data.sources) && data.sources.length>=5 && data.sources.some((source)=>source.id==='adapter-export') && data.sources.some((source)=>source.id==='docs-screenshots') && Array.isArray(data.blockers) && Array.isArray(data.releaseNoteDraft)"
check_json_field "Experiments release evidence matrix contract" "$BASE_URL/api/experiments/release-evidence-matrix" "data.ok===true && data.schemaVersion==='experiments.release-evidence-matrix.v1' && data.activeVersion==='v1.5.1' && Array.isArray(data.rounds) && data.rounds.length===125 && data.totals && data.totals.roundCount===125 && data.totals.plannedCount>=19 && data.rounds.filter((round)=>/^v1\\.[1-5]\\./.test(round.version)).every((round)=>round.completionPct>0) && data.rounds.some((round)=>round.version==='v1.6.8' && round.status==='complete') && data.rounds.some((round)=>round.version==='v1.10.1' && round.status==='planned') && data.rounds.some((round)=>round.version==='v1.12.0' && round.status==='planned') && ['v2.0.1','v2.0.2','v2.0.3','v2.0.4','v2.0.5','v2.1.0','v2.1.1','v2.1.2','v2.1.3','v2.1.4','v2.1.5','v2.1.6','v2.1.7','v2.1.8','v2.1.9','v2.2.0','v2.2.1','v2.2.2','v2.2.3','v2.2.4','v2.2.5','v2.2.6','v2.2.7','v2.2.8','v2.2.9','v2.3.0','v2.3.1','v2.3.2','v2.3.3','v2.3.4','v2.4.0','v2.4.1','v2.4.2','v2.4.3','v2.4.4','v2.4.5','v2.4.6','v2.4.7','v2.4.8','v2.4.9','v2.5.0','v2.5.1','v2.5.2','v2.5.3','v2.5.4','v2.6.0','v2.6.1','v2.6.2','v2.6.3','v2.6.4','v2.6.5','v2.6.6','v2.6.7','v2.6.8','v2.6.9','v2.7.0','v2.7.1','v2.7.2','v2.7.3','v2.7.4','v2.8.0','v2.8.1','v2.8.2','v2.8.3','v2.8.4','v2.8.5','v2.8.6','v2.8.7','v2.8.8','v2.8.9','v2.9.0','v2.9.1','v2.9.2','v2.9.3','v2.9.4'].every((version)=>data.rounds.some((round)=>round.version===version && round.status==='evidence-needed')) && data.rounds.every((round)=>typeof round.version==='string' && typeof round.completionPct==='number' && Array.isArray(round.shipped) && Array.isArray(round.evidence) && Array.isArray(round.blockers) && Array.isArray(round.nextActions))"
check_json_field "Experiments public release evidence contract" "$BASE_URL/api/experiments/public-release-evidence" "data.ok===true && data.schemaVersion==='experiments.public-release-evidence.v1' && data.docsRoute && data.docsRoute.route==='/release' && Array.isArray(data.docsFiles) && data.demoCapture && Array.isArray(data.demoCapture.flows) && data.distillation && typeof data.distillation.operationCount==='number' && data.totals && typeof data.totals.completionPct==='number' && Array.isArray(data.blockers) && Array.isArray(data.releaseNoteDraft)"
check_json_field "Experiments GA release evidence bundle contract" "$BASE_URL/api/experiments/ga-release-evidence" "data.ok===true && data.bundle && data.bundle.schemaVersion==='experiments.ga-release-evidence-bundle.v1' && data.bundle.nonCloudReadiness && data.bundle.productionReadiness && Array.isArray(data.bundle.sources) && data.bundle.sources.length>=7 && data.bundle.sources.every((source)=>typeof source.digest==='string' && source.digest.length===64) && data.bundle.integrity && data.bundle.integrity.algorithm==='sha256' && data.bundle.integrity.verified===true && typeof data.bundle.integrity.stateDigest==='string' && data.bundle.integrity.stateDigest.length===64 && data.bundle.totals && typeof data.bundle.totals.blockerCount==='number' && data.history && Array.isArray(data.history.entries) && data.verification && ['in-sync','drifted','missing','invalid'].includes(data.verification.status) && Array.isArray(data.verification.changedSourceIds)"
check_json_field "Experiments route smoke evidence contract" "$BASE_URL/api/experiments/route-smoke-evidence" "data.ok===true && data.evidence && data.evidence.schemaVersion==='experiments.route-smoke-evidence.v1' && data.evidence.totals && typeof data.evidence.totals.checkCount==='number' && data.evidence.integrity && ['verified','invalid','missing'].includes(data.evidence.integrity.status) && Array.isArray(data.evidence.failures) && data.evidence.history && Array.isArray(data.evidence.history.reports) && typeof data.evidence.history.consecutivePassCount==='number' && typeof data.evidence.history.verifiedCount==='number'"
check_json_field "Experiments release security evidence contract" "$BASE_URL/api/experiments/release-security-evidence" "data.ok===true && data.evidence && data.evidence.schemaVersion==='experiments.release-security-evidence.v1' && ['pass','evidence-needed','blocked'].includes(data.evidence.status) && data.evidence.secretScan && typeof data.evidence.secretScan.findingCount==='number' && data.evidence.packageAudit && typeof data.evidence.packageAudit.vulnerabilities.total==='number' && data.evidence.integrity && data.evidence.integrity.status==='verified' && data.evidence.history && Array.isArray(data.evidence.history.entries) && Array.isArray(data.evidence.blockers)"
check_json_field "Deployment control plane contract" "$BASE_URL/api/deployment" "data.ok===true && data.schemaVersion==='deployment.control-plane.v1' && Array.isArray(data.targets) && data.controlPlane && data.controlPlane.registry && data.controlPlane.usageOutbox && typeof data.controlPlane.usageOutbox.records==='number' && data.controlPlane.auditArchive && typeof data.controlPlane.auditArchive.archivedEvents==='number' && typeof data.controlPlane.auditArchive.immutableArchivedEvents==='number' && data.controlPlane.kmsSigning && typeof data.controlPlane.kmsSigning.verifiedReceipts==='number' && typeof data.controlPlane.kmsSigning.verifiedCloudReceipts==='number' && data.controlPlane.failover && typeof data.controlPlane.failover.rehearsals==='number' && data.controlPlane.cloud && typeof data.controlPlane.cloud.configured==='boolean' && typeof data.controlPlane.cloud.manifestLoaded==='boolean' && typeof data.controlPlane.cloud.configSource==='string' && data.readiness && typeof data.readiness.completionPct==='number' && Array.isArray(data.readiness.blockers) && data.localReadiness && data.productionReadiness && Array.isArray(data.productionReadiness.blockers) && Array.isArray(data.evidence)"
check_json_field "Deployment usage reconciliation" "$BASE_URL/api/deployment/usage-reconciliation" "data.ok===true && data.schemaVersion==='deployment.usage-reconciliation.v1' && Array.isArray(data.receipts) && data.latestPassing && data.latestPassing.differences.totalTokens===0"
check_json_field "Deployment usage settlement evidence" "$BASE_URL/api/deployment/usage-settlement" "data.ok===true && data.schemaVersion==='deployment.usage-settlement.v1' && data.latestPassing && data.latestPassing.checks.retryDelivered===true && data.latestPassing.checks.duplicateSuppressed===true"
check_json_field "Latest benchmark progress" "$BASE_URL/api/admin/benchmark/progress?latest=1" "typeof data === 'object'"
check_json_field "Canonical Benchmark run route" "$BASE_URL/api/benchmarks" "data.ok===true && data.schemaVersion==='benchmark.run-route.v1' && data.owner==='features/benchmark' && Array.isArray(data.methods) && data.methods.includes('POST')"
check_json_field "Canonical Benchmark baseline route" "$BASE_URL/api/benchmarks/baseline" "Array.isArray(data.baselines) && ('baseline' in data)"
check_json_field "Canonical Benchmark progress route" "$BASE_URL/api/benchmarks/progress?latest=1" "typeof data==='object' && (data.runId===null || typeof data.runId==='string')"
check_json_field "Canonical Benchmark prompt-set route" "$BASE_URL/api/benchmarks/prompt-sets" "Array.isArray(data.promptSets)"
check_text_contains "Canonical Benchmark report route" "$BASE_URL/api/benchmarks/report?windowMinutes=720" "# Benchmark Regression Report"
check_json_field "Canonical Benchmark evidence route" "$BASE_URL/api/benchmarks/evidence" "Array.isArray(data.entries) && data.summary && data.summary.schemaVersion==='benchmark.release-evidence-summary.v1'"
check_text_contains "Canonical Benchmark issue-summary export" "$BASE_URL/api/benchmarks/export?format=issue-summary&limit=1" "## Benchmark issue summary"
check_json_post_status "Canonical Compare progress validation" "$BASE_URL/api/compare/progress" '{}' '400' "typeof data.error==='string' && data.error.includes('requestId')"
check_json_field "Benchmark release evidence summary" "$BASE_URL/api/admin/benchmark/evidence" "Array.isArray(data.entries) && data.summary && data.summary.schemaVersion==='benchmark.release-evidence-summary.v1' && data.summary.totals && typeof data.summary.totals.evidenceCount==='number' && Array.isArray(data.summary.groups) && Array.isArray(data.summary.releaseNoteDraft)"
check_text_contains "Benchmark issue-summary export" "$BASE_URL/api/admin/benchmark/export?format=issue-summary&limit=1" "## Benchmark issue summary"
check_json_field "Provider Ops evidence summary" "$BASE_URL/api/admin/provider-health/evidence?windowHours=24" "data.ok===true && data.summary && data.summary.schemaVersion==='provider.ops-evidence-summary.v1' && data.summary.totals && typeof data.summary.totals.providerCount==='number' && data.summary.releaseProbe && typeof data.summary.releaseProbe.successCount==='number' && typeof data.summary.releaseProbe.totalCount==='number' && Array.isArray(data.summary.providers) && Array.isArray(data.summary.releaseNoteDraft) && data.snapshots && data.snapshots.schemaVersion==='provider.ops-evidence-snapshots.v1' && data.snapshots.integrity && typeof data.snapshots.integrity.verifiedCount==='number' && Array.isArray(data.snapshots.snapshots) && data.snapshots.snapshots.every((snapshot)=>snapshot.integrity && snapshot.integrity.algorithm==='sha256')"
check_json_field "Dashboard summary" "$BASE_URL/api/admin/dashboard?targetId=anthropic-claude&windowMinutes=720" "typeof data.summary === 'object' && data.adminCompatibilityUsage && typeof data.adminCompatibilityUsage.totalHits==='number' && Array.isArray(data.adminCompatibilityUsage.routes) && data.adminCompatibilitySunset && data.adminCompatibilitySunset.schemaVersion==='admin.compatibility-sunset.v1' && Array.isArray(data.adminCompatibilitySunset.routes) && data.adminCompatibilityDeletionManifest && data.adminCompatibilityDeletionManifest.schemaVersion==='admin.compatibility-deletion-manifest.v1' && Array.isArray(data.adminCompatibilityDeletionManifest.routes) && Array.isArray(data.providerHealthDesk) && data.providerHealthDesk.every((row)=>row.retryPolicy && Array.isArray(row.retryPolicy.templates) && typeof row.retryPolicy.recommendedTemplateId==='string') && data.benchmarkReleaseEvidenceSummary && data.benchmarkReleaseEvidenceSummary.schemaVersion==='benchmark.release-evidence-summary.v1' && data.providerOpsEvidenceSummary && data.providerOpsEvidenceSummary.schemaVersion==='provider.ops-evidence-summary.v1'"
check_json_field "Admin compatibility usage contract" "$BASE_URL/api/admin/compatibility-usage" "data.ok===true && data.summary && typeof data.summary.totalHits==='number' && typeof data.summary.runtimeHits==='number' && typeof data.summary.legacyUnclassifiedHits==='number' && Array.isArray(data.summary.routes) && data.sunset && data.sunset.schemaVersion==='admin.compatibility-sunset.v1' && data.sunset.totals && typeof data.sunset.totals.runtimeHitCount==='number' && typeof data.sunset.totals.legacyUnclassifiedHitCount==='number' && data.sunset.historicalArchives && typeof data.sunset.historicalArchives.archiveCount==='number' && typeof data.sunset.historicalArchives.archivedLegacyUnclassifiedHits==='number' && Array.isArray(data.sunset.routes) && Array.isArray(data.sunset.blockers) && data.deletionManifest && data.deletionManifest.schemaVersion==='admin.compatibility-deletion-manifest.v1' && Array.isArray(data.deletionManifest.routes) && data.deletionSignoffs && data.deletionSignoffs.schemaVersion==='admin.compatibility-deletion-signoffs.v1' && Array.isArray(data.deletionSignoffs.signoffs)"
check_json_field "Admin compatibility sign-off export contract" "$BASE_URL/api/admin/compatibility-usage/signoffs/export?format=json" "data.schemaVersion==='admin.compatibility-deletion-signoffs.v1' && typeof data.currentManifestDigest==='string' && Array.isArray(data.signoffs)"
check_json_field "Admin compatibility pre-sunset rehearsal export" "$BASE_URL/api/admin/compatibility-usage/rehearsal/export?format=json" "data.schemaVersion==='admin.compatibility-deletion-manifest.v1' && data.preSunsetStatus==='ready' && data.totals && data.totals.preSunsetReadyCount===data.totals.wrapperFileCount && Array.isArray(data.preSunsetBlockers) && data.preSunsetBlockers.length===0"
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
  write_smoke_report
  echo "Smoke test finished with $FAILURES failure(s)."
  exit 1
fi

write_smoke_report
echo "Smoke test passed."
