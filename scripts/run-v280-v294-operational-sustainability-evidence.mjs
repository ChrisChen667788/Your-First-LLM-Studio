#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/u, "");

async function readTrain(pathname, expectedSchema, expectedVersions, expectedSourceSignals) {
  const response = await fetch(`${baseUrl}${pathname}`, { signal: AbortSignal.timeout(30_000) });
  const payload = await response.json();
  const valid = response.ok && payload.ok === true && payload.schemaVersion === expectedSchema && payload.sourceStatus === "pass" && ["pass", "attention"].includes(payload.localStatus) && payload.externalStatus === "hold" && payload.productionStatus === "blocked" && payload.summary?.requiredVersions === expectedVersions && payload.sourceSummary?.sourceOwnedSignals === expectedSourceSignals && Array.isArray(payload.versions) && payload.versions.length === expectedVersions && payload.versions.every((version) => ["missing", "invalid", "verified"].includes(version.evidenceStatus) && version.checks?.localProductionTransitionDenied === true && version.sourceSignal && ["pass", "attention", "unavailable", "external-only"].includes(version.sourceSignal.status));
  if (!valid) throw new Error(payload.error || `${pathname} returned an invalid fail-closed state.`);
  return payload;
}

const remediation = await readTrain(
  "/api/experiments/operational-remediation-efficiency",
  "experiments.operational-remediation-efficiency.v1",
  10,
  9,
);
const sustainability = await readTrain(
  "/api/experiments/sustainable-operations-upgrade",
  "experiments.sustainable-operations-upgrade.v1",
  5,
  4,
);

const sourceSignals = [...remediation.versions, ...sustainability.versions].map((version) => ({
  version: version.version,
  label: version.label,
  sourceStatus: version.sourceSignal.status,
  sourceSummary: version.sourceSignal.summary,
  blockers: version.sourceSignal.blockers,
  externalEvidenceStatus: version.evidenceStatus,
  evidenceUri: version.sourceSignal.evidenceUri,
}));
const directory = path.join(root, "output", "release-evidence");
mkdirSync(directory, { recursive: true });
const outputPath = path.join(directory, "v2.8.0-v2.9.4-operational-sustainability.json");
const externallyVerifiedVersions = remediation.summary.verifiedVersions + sustainability.summary.verifiedVersions;
const output = {
  schemaVersion: "experiments.operational-sustainability-export.v1",
  generatedAt: new Date().toISOString(),
  baseUrl,
  sourceStatus: "pass",
  localStatus: sourceSignals.some((signal) => ["attention", "unavailable"].includes(signal.sourceStatus)) ? "attention" : "pass",
  externalStatus: "hold",
  productionStatus: "blocked",
  totals: {
    versions: 15,
    sourceOwnedSignals: 13,
    passingSourceSignals: sourceSignals.filter((signal) => signal.sourceStatus === "pass").length,
    attentionSourceSignals: sourceSignals.filter((signal) => signal.sourceStatus === "attention").length,
    unavailableSourceSignals: sourceSignals.filter((signal) => signal.sourceStatus === "unavailable").length,
    externalOnlySignals: sourceSignals.filter((signal) => signal.sourceStatus === "external-only").length,
    externallyVerifiedVersions,
  },
  sourceSignals,
  trains: { remediation, sustainability },
};
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...output.totals, localStatus: output.localStatus, externalStatus: output.externalStatus, productionStatus: output.productionStatus, outputPath }, null, 2));
