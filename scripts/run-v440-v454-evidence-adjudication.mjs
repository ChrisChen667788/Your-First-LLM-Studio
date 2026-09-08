#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/u, "");
const operatorToken = process.env.FIRST_LLM_OPERATOR_TOKEN || "";
const response = await fetch(`${baseUrl}/api/experiments/evidence-adjudication-train`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(operatorToken ? { authorization: `Bearer ${operatorToken}` } : {}),
  },
  body: "{}",
  signal: AbortSignal.timeout(30_000),
});
const payload = await response.json();
if (!response.ok || !payload.receipt || !payload.evidence) {
  throw new Error(payload.error || `Evidence adjudication acceptance returned HTTP ${response.status}.`);
}
const directory = path.join(root, "output", "release-evidence");
mkdirSync(directory, { recursive: true });
const outputPath = path.join(directory, "v4.4.0-v4.5.4-evidence-adjudication-train.json");
writeFileSync(outputPath, `${JSON.stringify({
  schemaVersion: "experiments.evidence-adjudication-train-export.v1",
  generatedAt: new Date().toISOString(),
  baseUrl,
  receipt: payload.receipt,
  evidence: payload.evidence,
}, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  sourceStatus: payload.receipt.sourceStatus,
  localStatus: payload.receipt.localStatus,
  externalStatus: payload.receipt.externalStatus,
  productionStatus: payload.receipt.productionStatus,
  totals: payload.receipt.totals,
  evidenceDigest: payload.receipt.evidenceDigest,
  outputPath,
}, null, 2));
