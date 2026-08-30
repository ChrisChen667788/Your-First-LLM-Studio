#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/, "");
const reportPath = path.join(root, "output", "ci-route-smoke.json");
const checks = [
  { id: "home", path: "/", kind: "html" },
  { id: "agent", path: "/agent", kind: "html" },
  { id: "compare", path: "/compare", kind: "html" },
  { id: "fine-tune", path: "/fine-tune", kind: "html" },
  { id: "models", path: "/models", kind: "html" },
  { id: "model-runtime", path: "/models/runtime", kind: "html" },
  { id: "benchmarks", path: "/benchmarks", kind: "html" },
  { id: "benchmark-standards", path: "/api/benchmarks/standards?refresh=manual", kind: "json", contract: "ok" },
  { id: "benchmark-qualification", path: "/api/benchmarks/qualification", kind: "json", contract: "ok" },
  { id: "benchmark-official-runs", path: "/api/benchmarks/official-runs", kind: "json", contract: "ok" },
  { id: "benchmark-reproducibility", path: "/api/benchmarks/reproducibility", kind: "json", contract: "ok" },
  { id: "benchmark-decision-intelligence", path: "/api/benchmarks/decision-intelligence", kind: "json", contract: "ok" },
  { id: "retrieval", path: "/retrieval", kind: "html" },
  { id: "experiments", path: "/experiments", kind: "html" },
  { id: "workflows", path: "/workflows", kind: "html" },
  { id: "admin", path: "/admin", kind: "html" },
  { id: "focus", path: "/focus", kind: "html" },
  { id: "inbox", path: "/inbox", kind: "html" },
  { id: "session-summary", path: "/session-summary", kind: "html" },
  { id: "release", path: "/release", kind: "html" },
  { id: "release-train-api", path: "/api/experiments/release-train", kind: "json", contract: "release-train" },
  { id: "ga-release-evidence", path: "/api/experiments/ga-release-evidence", kind: "json", contract: "ok" },
  { id: "workflow-api", path: "/api/workflows", kind: "json", contract: "ok" },
  { id: "finetune-capabilities-api", path: "/api/finetune/training-capabilities", kind: "json", contract: "object" },
  { id: "runtime-profiles-api", path: "/api/models/runtime-profiles", kind: "json", contract: "ok" },
  { id: "agent-action-trust-recovery-api", path: "/api/agent/action-trust-recovery", kind: "json", contract: "ok" },
  { id: "workflow-debugger-closure-api", path: "/api/workflows/debugger-closure", kind: "json", contract: "ok" },
  { id: "artifact-federation-trust-api", path: "/api/artifacts/federation-trust", kind: "json", contract: "ok" },
  { id: "model-supply-chain-operations-api", path: "/api/models/supply-chain-operations", kind: "json", contract: "ok" },
  { id: "rag-governance-api", path: "/api/retrieval/governance", kind: "json", contract: "ok" },
  { id: "reproducible-training-recipes-api", path: "/api/finetune/reproducible-recipes", kind: "json", contract: "ok" },
  { id: "quality-policy-safety-api", path: "/api/evaluation/quality-policy-safety", kind: "json", contract: "ok" },
  { id: "enterprise-control-plane-api", path: "/api/deployment/enterprise-control-plane", kind: "json", contract: "ok" },
  { id: "enterprise-production-ga-api", path: "/api/experiments/enterprise-production-ga", kind: "json", contract: "ok" },
  { id: "production-evidence-authority-api", path: "/api/experiments/production-evidence-authority", kind: "json", contract: "ok" },
  { id: "release-authority-decision-api", path: "/api/experiments/release-authority-decision", kind: "json", contract: "ok" },
  { id: "production-lifecycle-closure-api", path: "/api/experiments/production-lifecycle-closure", kind: "json", contract: "ok" },
  { id: "post-ga-operations-train-api", path: "/api/experiments/post-ga-operations-train", kind: "json", contract: "ok" },
  { id: "continuous-assurance-train-api", path: "/api/experiments/continuous-assurance-train", kind: "json", contract: "ok" },
  { id: "assurance-closure-train-api", path: "/api/experiments/assurance-closure-train", kind: "json", contract: "ok" },
  { id: "ai-operations-intelligence-api", path: "/api/experiments/ai-operations-intelligence", kind: "json", contract: "ok" },
  { id: "deployment-lifecycle-assurance-api", path: "/api/experiments/deployment-lifecycle-assurance", kind: "json", contract: "ok" },
  { id: "governed-autonomy-readiness-api", path: "/api/experiments/governed-autonomy-readiness", kind: "json", contract: "ok" },
  { id: "open-ecosystem-interoperability-api", path: "/api/experiments/open-ecosystem-interoperability", kind: "json", contract: "ok" },
  { id: "operational-remediation-efficiency-api", path: "/api/experiments/operational-remediation-efficiency", kind: "json", contract: "ok" },
  { id: "sustainable-operations-upgrade-api", path: "/api/experiments/sustainable-operations-upgrade", kind: "json", contract: "ok" },
  { id: "remediation-control-api", path: "/api/experiments/remediation-control", kind: "json", contract: "ok" },
  { id: "service-readiness-api", path: "/api/experiments/service-readiness", kind: "json", contract: "ok" },
  { id: "runtime-recovery-performance-api", path: "/api/models/runtime-recovery-performance", kind: "json", contract: "ok" },
  { id: "extension-foundation-api", path: "/api/extensions", kind: "json", contract: "object" },
  { id: "workspace-resources-api", path: "/api/governance/workspaces/resources", kind: "json", contract: "ok" },
  { id: "workspace-provenance-api", path: "/api/governance/workspace-provenance?execution=local", kind: "json", contract: "ok" },
  { id: "identity-workspace-mappings", path: "/api/governance/identity-mappings", kind: "json", contract: "ok" },
  { id: "identity-event-evidence", path: "/api/governance/identity-events", kind: "json", contract: "ok" },
  { id: "quality-ci-evidence", path: "/api/evaluation/quality-ci", kind: "json", contract: "ok" },
  { id: "v151-release-candidate-evidence", path: "/api/evaluation/release-candidate", kind: "json", contract: "ok" },
  { id: "v14-acceptance-evidence", path: "/api/experiments/v14-acceptance", kind: "json", contract: "ok" },
  { id: "enterprise-idp-adapter", path: "/api/governance/enterprise-idp", kind: "json", contract: "ok" },
  { id: "remote-worker-failover", path: "/api/workflows/remote-failover", kind: "json", contract: "ok" },
  { id: "production-bridges", path: "/api/experiments/production-bridges", kind: "json", contract: "ok" },
  { id: "artifact-trust-roots", path: "/api/artifacts/trust-roots", kind: "json", contract: "ok" },
  { id: "artifact-install-transactions", path: "/api/artifacts/install-transactions", kind: "json", contract: "ok" },
  { id: "artifact-staging-receipts", path: "/api/artifacts/staging-receipts", kind: "json", contract: "ok" },
  { id: "postgres-usage-outbox", path: "/api/deployment/durable-outbox", kind: "json", contract: "ok" },
  { id: "v15-acceptance-evidence", path: "/api/experiments/v15-acceptance", kind: "json", contract: "ok" },
  { id: "v163-benchmark-qualification", path: "/api/experiments/v163-benchmark-qualification", kind: "json", contract: "ok" },
  { id: "v164-official-evaluators", path: "/api/experiments/v164-official-evaluators", kind: "json", contract: "ok" },
  { id: "v165-benchmark-reproducibility", path: "/api/experiments/v165-benchmark-reproducibility", kind: "json", contract: "ok" },
  { id: "v166-benchmark-decision-intelligence", path: "/api/experiments/v166-benchmark-decision-intelligence", kind: "json", contract: "ok" },
  { id: "v167-workflow-execution-closure", path: "/api/experiments/v167-workflow-execution-closure", kind: "json", contract: "ok" },
  { id: "v168-finetune-execution-truth", path: "/api/experiments/v168-finetune-execution-truth", kind: "json", contract: "ok" },
  { id: "v169-finetune-quality-export", path: "/api/experiments/v169-finetune-quality-export", kind: "json", contract: "ok" },
  { id: "v170-benchmark-candidate-multimodal", path: "/api/experiments/v170-benchmark-candidate-multimodal", kind: "json", contract: "ok" },
  { id: "v171-v190-source-train", path: "/api/experiments/v171-v190-source-train", kind: "json", contract: "ok" },
  { id: "v1102-v1200-source-train", path: "/api/experiments/v1102-v1200-source-train", kind: "json", contract: "ok" },
];

function validateJsonContract(body, contract) {
  try {
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== "object") return false;
    if (contract === "release-train") return parsed.ok === true && Array.isArray(parsed.milestones);
    if (contract === "ok") return parsed.ok === true;
    return true;
  } catch {
    return false;
  }
}

const results = [];
for (const check of checks) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}${check.path}`, {
      headers: { accept: check.kind === "json" ? "application/json" : "text/html" },
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.text();
    const contentOk = check.kind === "json"
      ? validateJsonContract(body, check.contract)
      : body.length > 500 && !/Unhandled Runtime Error|Internal Server Error/i.test(body);
    results.push({
      ...check,
      status: response.status,
      ok: response.ok && contentOk,
      durationMs: Date.now() - startedAt,
      bytes: Buffer.byteLength(body),
      bodyDigest: createHash("sha256").update(body).digest("hex"),
    });
  } catch (error) {
    results.push({
      ...check,
      status: 0,
      ok: false,
      durationMs: Date.now() - startedAt,
      bytes: 0,
      error: error instanceof Error ? error.message : "Route check failed.",
    });
  }
}

const report = {
  schemaVersion: "first-llm-studio.ci-route-smoke.v1",
  generatedAt: new Date().toISOString(),
  baseUrl,
  ok: results.every((result) => result.ok),
  totals: {
    checks: results.length,
    passed: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
  },
  results,
};
mkdirSync(path.dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
