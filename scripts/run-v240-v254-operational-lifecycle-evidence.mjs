#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/u, "");

async function readTrain(pathname, expectedSchema, expectedVersions, expectedSourceSignals) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json();
  if (
    !response.ok ||
    payload.ok !== true ||
    payload.schemaVersion !== expectedSchema ||
    payload.sourceStatus !== "pass" ||
    !["pass", "attention"].includes(payload.localStatus) ||
    payload.externalStatus !== "hold" ||
    payload.productionStatus !== "blocked" ||
    payload.summary?.requiredVersions !== expectedVersions ||
    payload.sourceSummary?.sourceOwnedSignals !== expectedSourceSignals ||
    !Array.isArray(payload.versions) ||
    payload.versions.length !== expectedVersions ||
    payload.versions.some(
      (version) =>
        !["missing", "invalid", "verified"].includes(version.evidenceStatus) ||
        version.checks?.localProductionTransitionDenied !== true ||
        !version.sourceSignal ||
        !["pass", "attention", "unavailable", "external-only"].includes(
          version.sourceSignal.status,
        ),
    )
  ) {
    throw new Error(payload.error || `${pathname} returned an invalid fail-closed state.`);
  }
  return payload;
}

const aiOperations = await readTrain(
  "/api/experiments/ai-operations-intelligence",
  "experiments.ai-operations-intelligence.v1",
  10,
  9,
);
const deploymentLifecycle = await readTrain(
  "/api/experiments/deployment-lifecycle-assurance",
  "experiments.deployment-lifecycle-assurance.v1",
  5,
  4,
);

const directory = path.join(root, "output", "release-evidence");
mkdirSync(directory, { recursive: true });
const outputPath = path.join(
  directory,
  "v2.4.0-v2.5.4-operational-lifecycle.json",
);
const sourceSignals = [...aiOperations.versions, ...deploymentLifecycle.versions].map(
  (version) => ({
    version: version.version,
    label: version.label,
    sourceStatus: version.sourceSignal.status,
    sourceSummary: version.sourceSignal.summary,
    externalEvidenceStatus: version.evidenceStatus,
    evidenceUri: version.sourceSignal.evidenceUri,
  }),
);
writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: "experiments.operational-lifecycle-export.v1",
      generatedAt: new Date().toISOString(),
      baseUrl,
      sourceStatus: "pass",
      externalStatus: "hold",
      productionStatus: "blocked",
      totals: {
        versions: 15,
        sourceOwnedSignals: 13,
        passingSourceSignals: sourceSignals.filter(
          (signal) => signal.sourceStatus === "pass",
        ).length,
        externallyVerifiedVersions:
          aiOperations.summary.verifiedVersions +
          deploymentLifecycle.summary.verifiedVersions,
      },
      sourceSignals,
      trains: { aiOperations, deploymentLifecycle },
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(
  JSON.stringify(
    {
      sourceStatus: "pass",
      externalStatus: "hold",
      productionStatus: "blocked",
      versions: 15,
      passingSourceSignals: sourceSignals.filter(
        (signal) => signal.sourceStatus === "pass",
      ).length,
      externallyVerifiedVersions:
        aiOperations.summary.verifiedVersions +
        deploymentLifecycle.summary.verifiedVersions,
      outputPath,
    },
    null,
    2,
  ),
);
