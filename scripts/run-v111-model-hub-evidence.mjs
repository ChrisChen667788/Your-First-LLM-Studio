#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const value = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/, "");
const provider = value("--provider", "modelscope");
const repository = value("--repository", "onnx-community/tiny-gpt2-ONNX");
const revision = value("--revision", "master");
const runId = value("--run-id", new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14));
const destination = path.resolve(value(
  "--destination",
  path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability", "model-downloads", `v111-${runId}-tiny-gpt2`),
));
const externalRoot = path.resolve(value("--external-root", "/Volumes/HP ZHAN SSD/FirstLLMStudio/models"));
const publishPath = value("--publish");
const requireAuthentication = !args.includes("--allow-anonymous");
const files = [
  "config.json",
  "configuration.json",
  "generation_config.json",
  "merges.txt",
  "onnx/model_fp16.onnx",
  "special_tokens_map.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "vocab.json",
];

async function request(pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(120_000),
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || payload.receipt?.error || `${pathname} returned HTTP ${response.status}.`);
  }
  return payload;
}

console.log(`[v1.1.1] creating ${provider} transfer for ${repository}@${revision}`);
const created = await request("/api/models/hub-transfers", {
  method: "POST",
  body: JSON.stringify({ provider, repository, revision, destination, files }),
});
const sessionId = created.result.id;
for (let step = 1; step <= 100; step += 1) {
  const progress = await request("/api/models/hub-transfers", {
    method: "POST",
    body: JSON.stringify({ action: "transfer-step", sessionId, chunkBytes: 8 * 1024 * 1024 }),
  });
  const session = progress.result.session;
  const completed = session?.files?.filter((file) => file.job?.status === "completed").length || 0;
  const total = session?.files?.length || files.length;
  console.log(`[v1.1.1] transfer ${completed}/${total}`);
  if (progress.result.completed) break;
  if (step === 100) throw new Error("Hub transfer exceeded the 100-step safety limit.");
}

const finalized = await request("/api/models/hub-transfers", {
  method: "POST",
  body: JSON.stringify({ action: "finalize", sessionId, requireAuthentication }),
});
if (finalized.result.status !== "pass") {
  throw new Error(`Authenticated Hub receipt is ${finalized.result.status}: ${finalized.result.blockers.join(" ")}`);
}

const migrated = await request("/api/models/external-storage", {
  method: "POST",
  body: JSON.stringify({
    action: "physical-migration",
    sourcePath: destination,
    destinationRoot: externalRoot,
    operatorApproved: true,
    removeSourceAfterVerification: false,
  }),
});
if (migrated.receipt.status !== "pass") throw new Error(`Physical migration is ${migrated.receipt.status}.`);

const promotion = await request("/api/models/promotion-evidence");
const evidence = {
  schemaVersion: "models.v1.1.1-real-promotion-evidence.v1",
  generatedAt: new Date().toISOString(),
  status: promotion.status,
  authenticationRequired: requireAuthentication,
  transfer: finalized.result,
  migration: migrated.receipt,
  promotion,
};
const outputPath = path.join(root, "output", "release-evidence", "v1.1.1-model-hub-promotion.json");
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
if (publishPath) {
  const resolved = path.resolve(root, publishPath);
  mkdirSync(path.dirname(resolved), { recursive: true });
  writeFileSync(resolved, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}
console.log(JSON.stringify({
  status: evidence.status,
  sessionId,
  repository,
  resolvedRevision: finalized.result.resolvedRevision,
  files: finalized.result.totals.files,
  bytes: finalized.result.totals.bytes,
  externalVolume: migrated.receipt.volume?.volumeName,
  destination: migrated.receipt.destinationPath,
  evidenceDigest: promotion.evidenceDigest,
  outputPath,
  publishPath: publishPath || null,
}, null, 2));
if (requireAuthentication && evidence.status !== "pass") process.exit(1);
