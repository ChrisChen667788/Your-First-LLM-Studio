import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const baseUrl = (process.env.FIRST_LLM_STUDIO_BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/, "");
const dataDir = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
async function json(pathname, init, accepted = [200]) { const response = await fetch(`${baseUrl}${pathname}`, init); const body = await response.json(); if (!accepted.includes(response.status)) throw new Error(`${pathname} returned ${response.status}: ${body.error || body.detail || "unknown error"}`); return { status: response.status, body }; }
async function post(pathname, body, accepted) { return json(pathname, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, accepted); }

execFileSync(process.execPath, [path.join(process.cwd(), "scripts/rehearse-postgres-rls.mjs")], { stdio: "inherit", timeout: 240_000 });
const runtime = await post("/api/runtime/openai-conformance", { serverId: "local-ollama", baseUrl: "http://127.0.0.1:11434", model: "qwen3:0.6b" });
const extensionRegistry = (await json("/api/extensions")).body;
const extensionPlan = await post("/api/extensions/install-plan", { manifests: extensionRegistry.packages.map((entry) => entry.manifest) });
const sandbox = await post("/api/extensions/sandbox", {});
const deploy = await post("/api/workflows", { action: "create", input: "Post-v1 closure rehearsal." });
const baseline = Array.from({ length: 40 }, (_, index) => 0.45 + index % 5 * 0.01);
const candidate = baseline.map((value, index) => value + 0.08 + index % 3 * 0.002);
const evaluation = await post("/api/evaluation/statistics", { baseline, candidate, minimumDelta: 0.05, minimumSamples: 30 });
const artifact = await post("/api/artifacts/acceptance");
const apple = (await json("/api/desktop/apple-release-signing")).body;
const identity = (await json("/api/governance/identity")).body;
const closure = (await json("/api/experiments/post-v1-closure")).body;
const report = { schemaVersion: "experiments.post-v1-closure-rehearsal.v1", generatedAt: new Date().toISOString(), runtime: runtime.body.report, extensionPlan: extensionPlan.body.plan, sandbox: sandbox.body.receipt, workflow: deploy.body.execution, evaluation: evaluation.body.report, artifact: artifact.body.receipt, externalGates: { appleReady: apple.completed, oidcConfigured: identity.oidc.configured, scimConfigured: identity.scim.configured }, closure: closure.totals };
mkdirSync(dataDir, { recursive: true }); const reportPath = path.join(dataDir, "post-v1-closure-rehearsal.json"); writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`); console.log(JSON.stringify({ ok: true, reportPath, totals: closure.totals, externalGates: report.externalGates }, null, 2));
