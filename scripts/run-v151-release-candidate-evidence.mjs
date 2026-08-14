#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const value = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(
  /\/+$/u,
  "",
);
const publishPath = value("--publish");
const operatorToken = process.env.FIRST_LLM_OPERATOR_TOKEN || "";

const response = await fetch(`${baseUrl}/api/evaluation/release-candidate`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(operatorToken ? { authorization: `Bearer ${operatorToken}` } : {}),
  },
  body: "{}",
  signal: AbortSignal.timeout(120_000),
});
const payload = await response.json();
if (!response.ok || !payload.receipt) {
  throw new Error(
    payload.error ||
      `Release-candidate acceptance returned HTTP ${response.status}.`,
  );
}

const evidence = {
  schemaVersion: "evaluation.release-candidate-runner-evidence.v1",
  generatedAt: new Date().toISOString(),
  baseUrl,
  receipt: payload.receipt,
  evidence: payload.evidence,
};
const outputPath = path.join(
  root,
  "output",
  "release-evidence",
  "v1.5.1-release-candidate.json",
);
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
if (publishPath) {
  const resolved = path.resolve(root, publishPath);
  mkdirSync(path.dirname(resolved), { recursive: true });
  writeFileSync(resolved, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

console.log(
  JSON.stringify(
    {
      localStatus: payload.receipt.localStatus,
      productionStatus: payload.receipt.productionStatus,
      artifact: payload.receipt.artifact,
      workload: payload.receipt.workload,
      checks: payload.receipt.checks,
      evidenceDigest: payload.receipt.evidenceDigest,
      productionBlockers: payload.receipt.productionBlockers,
      outputPath,
      publishPath: publishPath || null,
    },
    null,
    2,
  ),
);

if (payload.receipt.localStatus !== "pass") process.exit(1);
