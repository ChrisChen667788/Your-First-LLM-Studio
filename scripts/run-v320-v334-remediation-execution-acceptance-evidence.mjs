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
  const plan = payload.remediationExecutionPlan;
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
    plan?.schemaVersion === "experiments.remediation-execution-plan.v1" &&
    plan?.summary?.totalActions === 7 &&
    plan?.checks?.everyActionHasIdempotencyKey === true &&
    plan?.checks?.everyActionHasLeaseAndFence === true &&
    plan?.checks?.everyActionHasRollback === true &&
    plan?.checks?.remoteMutationDenied === true &&
    plan?.checks?.productionTransitionDenied === true &&
    plan?.actions?.every((action) => action.remoteMutationAllowed === false) &&
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

const execution = await readTrain(
  "/api/experiments/remediation-execution",
  "experiments.remediation-execution-train.v1",
  10,
  9,
);
const acceptance = await readTrain(
  "/api/experiments/operational-acceptance",
  "experiments.operational-acceptance-train.v1",
  5,
  4,
);

const sourceSignals = [...execution.versions, ...acceptance.versions].map((version) => ({
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
  "v3.2.0-v3.3.4-remediation-execution-operational-acceptance.json",
);
const externallyVerifiedVersions = execution.summary.verifiedVersions + acceptance.summary.verifiedVersions;
const output = {
  schemaVersion: "experiments.remediation-execution-operational-acceptance-export.v1",
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
  remediationControlPlane: execution.remediationControlPlane,
  remediationExecutionPlan: execution.remediationExecutionPlan,
  sourceSignals,
  trains: { execution, acceptance },
};
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ...output.totals,
  executionActions: output.remediationExecutionPlan.summary.totalActions,
  readyActions: output.remediationExecutionPlan.summary.readyActions,
  blockedActions: output.remediationExecutionPlan.summary.blockedActions,
  localStatus: output.localStatus,
  externalStatus: output.externalStatus,
  productionStatus: output.productionStatus,
  outputPath,
}, null, 2));
