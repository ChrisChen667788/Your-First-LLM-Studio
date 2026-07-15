import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const baseUrl = (process.env.FIRST_LLM_STUDIO_BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/, "");
const dataDir =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const model = process.env.FIRST_LLM_DESKTOP_PROOF_MODEL || "qwen3:0.6b";

async function studio(pathname, init) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const body = await response.json();
  if (!response.ok || body.ok === false) throw new Error(`${pathname}: ${body.error || response.status}`);
  return body;
}

async function recordLocalChatProof() {
  const startedAt = Date.now();
  let proof;
  try {
    const response = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        messages: [{ role: "user", content: "Reply with exactly: LOCAL CHAT READY" }],
        options: { temperature: 0, num_predict: 24 },
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const body = await response.json();
    if (!response.ok || !body.message?.content) throw new Error(body.error || `Ollama returned ${response.status}.`);
    proof = {
      schemaVersion: "desktop.local-chat-proof.v1",
      generatedAt: new Date().toISOString(),
      status: "pass",
      provider: "ollama",
      model,
      latencyMs: Date.now() - startedAt,
      responseDigest: createHash("sha256").update(body.message.content).digest("hex"),
      promptTokens: body.prompt_eval_count || 0,
      completionTokens: body.eval_count || 0,
    };
  } catch (error) {
    proof = {
      schemaVersion: "desktop.local-chat-proof.v1",
      generatedAt: new Date().toISOString(),
      status: "failed",
      provider: "ollama",
      model,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Local chat proof failed.",
    };
  }
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, "desktop-local-chat-proof.json"), `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  if (proof.status !== "pass") throw new Error(proof.error);
  return proof;
}

const buildArgs = [path.join(root, "scripts", "build-desktop-rc.mjs")];
if (process.argv.includes("--skip-next-build")) buildArgs.push("--skip-next-build");
execFileSync(process.execPath, buildArgs, {
  cwd: root,
  stdio: "inherit",
  timeout: 45 * 60_000,
});
execFileSync(process.execPath, [path.join(root, "scripts", "verify-desktop-dmg.mjs")], {
  cwd: root,
  stdio: "inherit",
  timeout: 5 * 60_000,
});
const localChat = await recordLocalChatProof();
const rehearsal = await studio("/api/desktop/onboarding-release", { method: "POST" });
const evidence = await studio("/api/desktop/onboarding-release");
const report = {
  schemaVersion: "desktop.v1.1.0-release-rehearsal.v1",
  generatedAt: new Date().toISOString(),
  version: evidence.version,
  status: evidence.status,
  localRcReady: evidence.localRcReady,
  gaReady: evidence.gaReady,
  totals: evidence.totals,
  localChat,
  lifecycleReceipt: rehearsal.receipt,
  releaseManifest: evidence.paths.releaseManifest,
  gaBlockers: evidence.gaBlockers,
};
const reportPath = path.join(dataDir, "desktop-v1.1.0-release-rehearsal.json");
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: evidence.localRcReady, reportPath, report }, null, 2));
if (!evidence.localRcReady) process.exitCode = 1;
