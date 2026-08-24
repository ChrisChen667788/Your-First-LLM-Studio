#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/u, "");
const operatorToken = process.env.FIRST_LLM_OPERATOR_TOKEN || "";
const response = await fetch(`${baseUrl}/api/experiments/enterprise-production-ga`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(operatorToken ? { authorization: `Bearer ${operatorToken}` } : {}),
  },
  body: "{}",
  signal: AbortSignal.timeout(30_000),
});
const payload = await response.json();
if ((!response.ok && response.status !== 422) || !payload.receipt) {
  throw new Error(payload.error || `Enterprise production GA gate returned HTTP ${response.status}.`);
}
if (payload.receipt.productionStatus !== "blocked") {
  throw new Error("The local v2.0.0 evidence command must never promote production.");
}
const directory = path.join(root, "output", "release-evidence");
mkdirSync(directory, { recursive: true });
const outputPath = path.join(directory, "v2.0.0-enterprise-production-ga.json");
writeFileSync(
  outputPath,
  `${JSON.stringify({ schemaVersion: "experiments.enterprise-production-ga-export.v1", generatedAt: new Date().toISOString(), baseUrl, receipt: payload.receipt, evidence: payload.evidence }, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify({ localStatus: payload.receipt.localStatus, externalStatus: payload.receipt.externalStatus, productionStatus: payload.receipt.productionStatus, checks: payload.receipt.checks, outputPath }, null, 2));
