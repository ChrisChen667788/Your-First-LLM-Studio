#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/u, "");
const operatorToken = process.env.FIRST_LLM_OPERATOR_TOKEN || "";
const response = await fetch(`${baseUrl}/api/experiments/v169-finetune-quality-export`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(operatorToken ? { authorization: `Bearer ${operatorToken}` } : {}),
  },
  body: "{}",
  signal: AbortSignal.timeout(120_000),
});
const payload = await response.json();
if ((!response.ok && response.status !== 422) || !payload.receipt) {
  throw new Error(payload.error || `v1.6.9 acceptance returned HTTP ${response.status}.`);
}

const outputPath = path.join(root, "output", "release-evidence", "v1.6.9-finetune-quality-export.json");
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify({
  schemaVersion: "finetune.quality-export-runner-evidence.v1",
  generatedAt: new Date().toISOString(),
  baseUrl,
  receipt: payload.receipt,
  evidence: payload.evidence,
}, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  localStatus: payload.receipt.localStatus,
  productionStatus: payload.receipt.productionStatus,
  totals: payload.receipt.totals,
  quality: payload.receipt.quality,
  package: payload.receipt.package,
  evidenceDigest: payload.receipt.evidenceDigest,
  outputPath,
}, null, 2));
if (payload.receipt.localStatus !== "pass") process.exitCode = 1;
