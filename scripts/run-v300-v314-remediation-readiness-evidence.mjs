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
  const controlPlane = payload.remediationControlPlane;
  const valid =
    response.ok &&
    payload.ok === true &&
    payload.schemaVersion === expectedSchema &&
    payload.sourceStatus === "pass" &&
    ["pass", "attention"].includes(payload.localStatus) &&
    payload.externalStatus === "hold" &&
    payload.productionStatus === "blocked" &&
    payload.summary?.requiredVersions === expectedVersions &&
    payload.sourceSummary?.sourceOwnedSignals === expectedSourceSignals &&
    controlPlane?.schemaVersion === "experiments.operational-remediation-control-plane.v1" &&
    controlPlane?.summary?.totalItems === 15 &&
    controlPlane?.checks?.dependencyGraphAcyclic === true &&
    controlPlane?.productionStatus === "blocked" &&
    Array.isArray(payload.versions) &&
    payload.versions.length === expectedVersions &&
    payload.versions.every(
      (version) =>
        ["missing", "invalid", "verified"].includes(version.evidenceStatus) &&
        version.checks?.localProductionTransitionDenied === true &&
        version.sourceSignal &&
        ["pass", "attention", "unavailable", "external-only"].includes(
          version.sourceSignal.status,
        ),
    );
  if (!valid) {
    throw new Error(payload.error || `${pathname} returned an invalid fail-closed state.`);
  }
  return payload;
}

const remediation = await readTrain(
  "/api/experiments/remediation-control",
  "experiments.remediation-control-train.v1",
  10,
  9,
);
const readiness = await readTrain(
  "/api/experiments/service-readiness",
  "experiments.service-readiness-train.v1",
  5,
  4,
);

const sourceSignals = [...remediation.versions, ...readiness.versions].map(
  (version) => ({
    version: version.version,
    label: version.label,
    sourceStatus: version.sourceSignal.status,
    sourceSummary: version.sourceSignal.summary,
    blockers: version.sourceSignal.blockers,
    externalEvidenceStatus: version.evidenceStatus,
    evidenceUri: version.sourceSignal.evidenceUri,
  }),
);
const directory = path.join(root, "output", "release-evidence");
mkdirSync(directory, { recursive: true });
const outputPath = path.join(
  directory,
  "v3.0.0-v3.1.4-remediation-service-readiness.json",
);
const externallyVerifiedVersions =
  remediation.summary.verifiedVersions + readiness.summary.verifiedVersions;
const output = {
  schemaVersion: "experiments.remediation-service-readiness-export.v1",
  generatedAt: new Date().toISOString(),
  baseUrl,
  sourceStatus: "pass",
  localStatus: sourceSignals.some((signal) =>
    ["attention", "unavailable"].includes(signal.sourceStatus),
  )
    ? "attention"
    : "pass",
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
  remediationControlPlane: remediation.remediationControlPlane,
  sourceSignals,
  trains: { remediation, readiness },
};
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      ...output.totals,
      remediationItems: output.remediationControlPlane.summary.totalItems,
      openItems: output.remediationControlPlane.summary.openItems,
      blockedItems: output.remediationControlPlane.summary.blockedItems,
      localStatus: output.localStatus,
      externalStatus: output.externalStatus,
      productionStatus: output.productionStatus,
      outputPath,
    },
    null,
    2,
  ),
);
