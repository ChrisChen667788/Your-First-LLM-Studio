#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/u, "");

async function readTrain(pathname, expectedSchema, expectedVersions, expectedSourceSignals) {
  const response = await fetch(`${baseUrl}${pathname}`, { signal: AbortSignal.timeout(30_000) });
  const payload = await response.json();
  const lifecycle = payload.ownerReceiptLifecycle;
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
    lifecycle?.schemaVersion === "experiments.owner-receipt-lifecycle.v1" &&
    lifecycle?.productionStatus === "blocked" &&
    lifecycle?.checks?.eventChainValid === true &&
    lifecycle?.checks?.strictRevisionSequence === true &&
    lifecycle?.checks?.sensitivePayloadNotPersisted === true &&
    lifecycle?.checks?.externalSignatureStillRequired === true &&
    lifecycle?.checks?.productionTransitionDenied === true &&
    Array.isArray(payload.versions) &&
    payload.versions.length === expectedVersions &&
    payload.versions.every(
      (version) =>
        ["missing", "invalid", "verified"].includes(version.evidenceStatus) &&
        version.checks?.localProductionTransitionDenied === true &&
        version.sourceSignal &&
        ["pass", "attention", "unavailable", "external-only"].includes(version.sourceSignal.status),
    );
  if (!valid) throw new Error(payload.error || `${pathname} returned an invalid fail-closed state.`);
  return payload;
}

const receipts = await readTrain(
  "/api/experiments/owner-receipt-lifecycle",
  "experiments.owner-receipt-intake-train.v1",
  10,
  9,
);
const exceptions = await readTrain(
  "/api/experiments/operational-exception-lifecycle",
  "experiments.operational-exception-lifecycle-train.v1",
  5,
  4,
);

const sourceSignals = [...receipts.versions, ...exceptions.versions].map((version) => ({
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
const outputPath = path.join(directory, "v3.6.0-v3.7.4-owner-receipt-exception-lifecycle.json");
const output = {
  schemaVersion: "experiments.owner-receipt-exception-lifecycle-export.v1",
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
    externallyVerifiedVersions: receipts.summary.verifiedVersions + exceptions.summary.verifiedVersions,
  },
  ownerReceiptLifecycle: receipts.ownerReceiptLifecycle,
  ownerWorkloadProtocol: receipts.ownerWorkloadProtocol,
  sourceSignals,
  trains: { receipts, exceptions },
};
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ...output.totals,
  revision: output.ownerReceiptLifecycle.revision,
  decisionPackageDigest: output.ownerReceiptLifecycle.decisionPackageDigest,
  localStatus: output.localStatus,
  externalStatus: output.externalStatus,
  productionStatus: output.productionStatus,
  outputPath,
}, null, 2));

