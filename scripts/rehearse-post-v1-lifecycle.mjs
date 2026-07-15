import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const baseUrl = (process.env.FIRST_LLM_STUDIO_BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/, "");
const dataDir = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
async function json(pathname, init, accepted = [200]) { const response = await fetch(`${baseUrl}${pathname}`, init); const body = await response.json(); if (!accepted.includes(response.status)) throw new Error(`${pathname} returned ${response.status}: ${body.error || body.detail || "unknown error"}`); return body; }
async function post(pathname) { return json(pathname, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); }

execFileSync(process.execPath, [path.join(process.cwd(), "scripts/rehearse-post-v1-acceptance.mjs")], { stdio: "inherit", timeout: 300_000 });
const endpoints = [
  "/api/desktop/service-supervisor", "/api/desktop/permission-repair", "/api/models/source-manifests", "/api/models/transfer-scheduler", "/api/models/removal-lifecycle",
  "/api/models/server-instances/switch-controller", "/api/models/server-instances/log-retention", "/api/runtime/remote-failover", "/api/extensions/permission-grants", "/api/extensions/quarantine-review",
  "/api/workflows/deployment-access", "/api/governance/access-reviews", "/api/evaluation/baseline-promotion", "/api/artifacts/install-lifecycle", "/api/deployment/usage-settlement",
];
const receipts = {};
for (const endpoint of endpoints) receipts[endpoint] = (await post(endpoint)).receipt;
const aggregate = await json("/api/experiments/post-v1-lifecycle");
const report = { schemaVersion: "experiments.post-v1-lifecycle-rehearsal.v1", generatedAt: new Date().toISOString(), receipts, totals: aggregate.totals };
mkdirSync(dataDir, { recursive: true }); const reportPath = path.join(dataDir, "post-v1-lifecycle-rehearsal.json"); writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: aggregate.totals.ready === aggregate.totals.slices, reportPath, totals: aggregate.totals }, null, 2));
