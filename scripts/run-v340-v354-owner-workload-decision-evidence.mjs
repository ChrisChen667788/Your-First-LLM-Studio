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
  const protocol = payload.ownerWorkloadProtocol;
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
    protocol?.schemaVersion === "experiments.owner-workload-protocol.v1" &&
    protocol?.summary?.totalRequests === 7 &&
    protocol?.checks?.everyActionBound === true &&
    protocol?.checks?.strictRequestDigests === true &&
    protocol?.checks?.rollbackAlwaysRequired === true &&
    protocol?.checks?.remoteMutationDenied === true &&
    protocol?.checks?.productionTransitionDenied === true &&
    protocol?.requests?.every((request) => request.remoteMutationAllowed === false) &&
    Array.isArray(payload.versions) &&
    payload.versions.length === expectedVersions &&
    payload.versions.every(
      (version) =>
        ["missing", "invalid", "verified"].includes(version.evidenceStatus) &&
        version.checks?.localProductionTransitionDenied === true &&
        version.sourceSignal &&
        ["pass", "attention", "unavailable", "external-only"].includes(version.sourceSignal.status),
    );
  if (!valid) {
    throw new Error(payload.error || `${pathname} returned an invalid fail-closed state.`);
  }
  return payload;
}

const admission = await readTrain(
  "/api/experiments/owner-workload-admission",
  "experiments.owner-workload-admission-train.v1",
  10,
  9,
);
const decision = await readTrain(
  "/api/experiments/operational-decision-governance",
  "experiments.operational-decision-governance-train.v1",
  5,
  4,
);

const sourceSignals = [...admission.versions, ...decision.versions].map((version) => ({
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
const outputPath = path.join(
  directory,
  "v3.4.0-v3.5.4-owner-workload-operational-decision.json",
);
const externallyVerifiedVersions = admission.summary.verifiedVersions + decision.summary.verifiedVersions;
const output = {
  schemaVersion: "experiments.owner-workload-operational-decision-export.v1",
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
  ownerWorkloadProtocol: admission.ownerWorkloadProtocol,
  remediationExecutionPlan: admission.remediationExecutionPlan,
  sourceSignals,
  trains: { admission, decision },
};
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ...output.totals,
  completedRequests: output.ownerWorkloadProtocol.summary.completedRequests,
  admittedRequests: output.ownerWorkloadProtocol.summary.admittedRequests,
  blockedRequests: output.ownerWorkloadProtocol.summary.blockedRequests,
  localStatus: output.localStatus,
  externalStatus: output.externalStatus,
  productionStatus: output.productionStatus,
  outputPath,
}, null, 2));
