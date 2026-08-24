#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/u, "");
const response = await fetch(`${baseUrl}/api/models/runtime-recovery-performance`, {
  headers: { accept: "application/json" },
  signal: AbortSignal.timeout(30_000),
});
const evidence = await response.json();

if (!response.ok || evidence?.ok !== true) {
  throw new Error(evidence?.error || `Runtime recovery evidence returned HTTP ${response.status}.`);
}

const directory = path.join(root, "output", "release-evidence");
mkdirSync(directory, { recursive: true });
const outputPath = path.join(directory, "v1.10.2-runtime-recovery-performance.json");
writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: "models.runtime-recovery-performance-evidence-export.v1",
      generatedAt: new Date().toISOString(),
      baseUrl,
      evidence,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
console.log(
  JSON.stringify(
    {
      localStatus: evidence.localStatus,
      productionStatus: evidence.productionStatus,
      comparisonStatus: evidence.performance?.comparison?.status,
      observedRecoveryOperations: evidence.recovery?.observedOperations,
      outputPath,
    },
    null,
    2,
  ),
);
