#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/u, "");

async function readTrain(pathname, expectedSchema, expectedVersions) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json();
  if (
    !response.ok ||
    payload.schemaVersion !== expectedSchema ||
    payload.sourceStatus !== "pass" ||
    payload.externalStatus !== "hold" ||
    payload.productionStatus !== "blocked" ||
    payload.summary?.requiredVersions !== expectedVersions ||
    !Array.isArray(payload.versions) ||
    payload.versions.length !== expectedVersions ||
    payload.versions.some(
      (version) =>
        !["missing", "invalid", "verified"].includes(version.evidenceStatus) ||
        version.checks?.localProductionTransitionDenied !== true,
    )
  ) {
    throw new Error(payload.error || `${pathname} returned an invalid fail-closed state.`);
  }
  return payload;
}

const continuousAssurance = await readTrain(
  "/api/experiments/continuous-assurance-train",
  "experiments.continuous-assurance-train.v1",
  10,
);
const assuranceClosure = await readTrain(
  "/api/experiments/assurance-closure-train",
  "experiments.assurance-closure-train.v1",
  5,
);

const directory = path.join(root, "output", "release-evidence");
mkdirSync(directory, { recursive: true });
const outputPath = path.join(directory, "v2.2.0-v2.3.4-assurance-train.json");
writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: "experiments.assurance-continuation-export.v1",
      generatedAt: new Date().toISOString(),
      baseUrl,
      productionStatus: "blocked",
      trains: { continuousAssurance, assuranceClosure },
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(
  JSON.stringify(
    {
      productionStatus: "blocked",
      verifiedVersions:
        continuousAssurance.summary.verifiedVersions +
        assuranceClosure.summary.verifiedVersions,
      requiredVersions: 15,
      outputPath,
    },
    null,
    2,
  ),
);
