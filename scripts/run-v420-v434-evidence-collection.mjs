#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/u, "");
const operatorToken = process.env.FIRST_LLM_OPERATOR_TOKEN || "";
const response = await fetch(`${baseUrl}/api/experiments/evidence-collection-train`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(operatorToken ? { authorization: `Bearer ${operatorToken}` } : {}),
  },
  body: JSON.stringify({ action: "record-train" }),
  signal: AbortSignal.timeout(30_000),
});
const payload = await response.json();
if (!response.ok || !payload.result || !payload.evidence) {
  throw new Error(payload.error || `Evidence collection acceptance returned HTTP ${response.status}.`);
}
const directory = path.join(root, "output", "release-evidence");
mkdirSync(directory, { recursive: true });
const outputPath = path.join(directory, "v4.2.0-v4.3.4-evidence-collection-train.json");
writeFileSync(outputPath, `${JSON.stringify({
  schemaVersion: "experiments.evidence-collection-train-export.v1",
  generatedAt: new Date().toISOString(),
  baseUrl,
  receipt: payload.result,
  evidence: payload.evidence,
}, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  sourceStatus: payload.result.sourceStatus,
  localStatus: payload.result.localStatus,
  externalStatus: payload.result.externalStatus,
  productionStatus: payload.result.productionStatus,
  totals: payload.result.totals,
  evidenceDigest: payload.result.evidenceDigest,
  outputPath,
}, null, 2));
