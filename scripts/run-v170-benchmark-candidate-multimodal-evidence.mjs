#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/u, "");
const operatorToken = process.env.FIRST_LLM_OPERATOR_TOKEN || "";
const requirePass = process.argv.includes("--require-pass");
const response = await fetch(
  `${baseUrl}/api/experiments/v170-benchmark-candidate-multimodal`,
  {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(operatorToken ? { authorization: `Bearer ${operatorToken}` } : {}),
    },
    body: "{}",
    signal: AbortSignal.timeout(30_000),
  },
);
const payload = await response.json();
if ((!response.ok && response.status !== 422) || !payload.receipt) {
  throw new Error(payload.error || `v1.7.0 acceptance returned HTTP ${response.status}.`);
}

const evidence = {
  schemaVersion: "experiments.v170-benchmark-candidate-multimodal-evidence.v1",
  generatedAt: new Date().toISOString(),
  baseUrl,
  receipt: payload.receipt,
  evidence: payload.evidence,
};
const directory = path.join(root, "output", "release-evidence");
mkdirSync(directory, { recursive: true });
const outputPath = path.join(directory, "v1.7.0-benchmark-candidate-multimodal.json");
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  localStatus: payload.receipt.localStatus,
  candidatePromotionStatus: payload.receipt.candidatePromotionStatus,
  multimodalExecutionStatus: payload.receipt.multimodalExecutionStatus,
  productionStatus: payload.receipt.productionStatus,
  totals: payload.receipt.totals,
  evidenceDigest: payload.receipt.evidenceDigest,
  outputPath,
}, null, 2));
if (requirePass && payload.receipt.localStatus !== "pass") process.exitCode = 1;
