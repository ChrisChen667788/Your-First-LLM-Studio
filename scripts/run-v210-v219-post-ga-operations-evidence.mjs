#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/u, "");
const response = await fetch(`${baseUrl}/api/experiments/post-ga-operations-train`, {
  signal: AbortSignal.timeout(30_000),
});
const payload = await response.json();
if (
  !response.ok ||
  payload.sourceStatus !== "pass" ||
  payload.externalStatus !== "hold" ||
  payload.productionStatus !== "blocked" ||
  payload.summary?.requiredVersions !== 10 ||
  !Array.isArray(payload.versions) ||
  payload.versions.length !== 10
) {
  throw new Error(payload.error || "Post-GA operations train returned an invalid fail-closed state.");
}
const directory = path.join(root, "output", "release-evidence");
mkdirSync(directory, { recursive: true });
const outputPath = path.join(directory, "v2.1.0-v2.1.9-post-ga-operations.json");
writeFileSync(
  outputPath,
  `${JSON.stringify({ schemaVersion: "experiments.post-ga-operations-train-export.v1", generatedAt: new Date().toISOString(), baseUrl, evidence: payload }, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify({ productionStatus: payload.productionStatus, verifiedVersions: payload.summary.verifiedVersions, outputPath }, null, 2));
