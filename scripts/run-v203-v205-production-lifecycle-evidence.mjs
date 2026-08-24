#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/u, "");
const response = await fetch(`${baseUrl}/api/experiments/production-lifecycle-closure`, {
  signal: AbortSignal.timeout(30_000),
});
const payload = await response.json();
if (!response.ok || payload.productionStatus !== "blocked") {
  throw new Error(payload.error || "Production lifecycle closure returned an invalid production state.");
}
const directory = path.join(root, "output", "release-evidence");
mkdirSync(directory, { recursive: true });
const outputPath = path.join(directory, "v2.0.3-v2.0.5-production-lifecycle.json");
writeFileSync(
  outputPath,
  `${JSON.stringify({ schemaVersion: "experiments.production-lifecycle-closure-export.v1", generatedAt: new Date().toISOString(), baseUrl, evidence: payload }, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify({ productionStatus: payload.productionStatus, verifiedStages: payload.summary?.verifiedStages, outputPath }, null, 2));
