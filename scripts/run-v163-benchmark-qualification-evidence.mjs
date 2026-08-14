#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(
  /\/+$/,
  "",
);
const response = await fetch(
  `${baseUrl}/api/experiments/v163-benchmark-qualification`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(90_000),
  },
);
const payload = await response.json();
if (!response.ok || payload?.evidence?.localStatus !== "pass") {
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

const localDataDir = payload?.evidence?.path
  ? path.dirname(payload.evidence.path)
  : "";
function portable(value) {
  if (Array.isArray(value)) return value.map(portable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, portable(entry)]),
    );
  }
  if (
    typeof value === "string" &&
    localDataDir &&
    value.startsWith(localDataDir)
  ) {
    return `<LOCAL_AGENT_DATA_DIR>${value.slice(localDataDir.length)}`;
  }
  return value;
}

const evidence = {
  schemaVersion: "experiments.v163-benchmark-qualification-runner-evidence.v1",
  generatedAt: new Date().toISOString(),
  sourceUrl: `${baseUrl}/api/experiments/v163-benchmark-qualification`,
  receipt: portable(payload.receipt),
  readModel: {
    schemaVersion: payload.evidence.schemaVersion,
    localStatus: payload.evidence.localStatus,
    productionStatus: payload.evidence.productionStatus,
    snapshotIntegrity: payload.evidence.snapshotIntegrity,
    totals: payload.evidence.totals,
    qualifiedDataset: payload.evidence.qualifiedDataset,
    productionBlockers: payload.evidence.productionBlockers,
  },
};
const runtimeRunId = process.env.V163_BENCHMARK_RUN_ID?.trim() || "";
if (runtimeRunId) {
  const reportResponse = await fetch(
    `${baseUrl}/api/benchmarks/report?runId=${encodeURIComponent(runtimeRunId)}`,
    { signal: AbortSignal.timeout(30_000) },
  );
  const report = await reportResponse.text();
  if (!reportResponse.ok || !report.includes(`Run ID: ${runtimeRunId}`)) {
    throw new Error(`Benchmark runtime smoke ${runtimeRunId} was not found.`);
  }
  evidence.runtimeSmoke = {
    runId: runtimeRunId,
    reportDigest: createHash("sha256").update(report).digest("hex"),
    report,
  };
}
const outputPath = path.resolve(
  "docs/release-evidence/v1.6.3-benchmark-qualification-latest.json",
);
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      ok: true,
      outputPath,
      receiptId: payload.receipt.id,
      checks: payload.receipt.totals,
      revision: payload.receipt.manifest.revision,
      snapshotSha256: payload.receipt.manifest.sha256,
    },
    null,
    2,
  ),
);
