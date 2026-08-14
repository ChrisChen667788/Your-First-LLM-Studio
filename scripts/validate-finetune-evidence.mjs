#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDirectories = [
  "docs/release-evidence/finetune-real-lora-2026-07-01",
  "docs/release-evidence/finetune-qwen4b-lora-2026-07-01",
];

const reports = evidenceDirectories.map((relativeDirectory) => {
  const directory = path.join(root, relativeDirectory);
  const manifestPath = path.join(directory, "run-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const textFiles = readdirSync(directory)
    .filter((file) => /\.(?:csv|json|md|svg)$/u.test(file))
    .map((file) => ({ file, content: readFileSync(path.join(directory, file), "utf8") }));
  const requiredRecipeKeys = [
    "targetModules",
    "scheduler",
    "warmupRatio",
    "packingPolicy",
    "evalEverySteps",
    "saveEverySteps",
    "bestCheckpointMetric",
    "loadBestCheckpointAtEnd",
    "seed",
  ];
  const checks = {
    manifestSchema: manifest.evidenceSchemaVersion === "finetune.public-release-evidence.v1",
    immutableModelRevision: typeof manifest.baseModel === "string" && /^hf:\/\/.+@[^/]+$/u.test(manifest.baseModel),
    portablePaths: textFiles.every(({ content }) => !/\/Users\/|[A-Za-z]:\\Users\\/u.test(content)),
    recipeContract: requiredRecipeKeys.every((key) => Object.hasOwn(manifest.recipe || {}, key)),
    checkpointCadence: manifest.recipe?.saveEverySteps === 100 && manifest.recipe?.evalEverySteps === 100,
    checkpointEvidence: Array.isArray(manifest.checkpointEvents) && manifest.checkpointEvents.length > 0 && manifest.checkpointEvents.every((entry) => typeof entry.path === "string" && entry.path.startsWith("runtime-artifacts/")),
    qualityLimitationsExplicit: manifest.qualityEvidence?.promotionStatus === "hold" && manifest.qualityEvidence?.taskQualityValidated === false && manifest.qualityEvidence?.externalBlindEval === false && manifest.qualityEvidence?.multiSeedValidated === false && manifest.qualityEvidence?.baselineComparable === false && Array.isArray(manifest.qualityEvidence?.blockers) && manifest.qualityEvidence.blockers.length >= 2,
    runtimeArtifactsNotMisrepresented: manifest.publicArtifacts?.runtimeArtifactsPublished === false && Array.isArray(manifest.publicArtifacts?.excludedRuntimeArtifacts) && manifest.publicArtifacts.excludedRuntimeArtifacts.length >= 4,
    publishedFilesExist: Array.isArray(manifest.publicArtifacts?.includedFiles) && manifest.publicArtifacts.includedFiles.length >= 7 && manifest.publicArtifacts.includedFiles.every((file) => existsSync(path.join(directory, file))),
  };
  return {
    directory: relativeDirectory,
    jobId: manifest.jobId,
    workflowStatus: manifest.status,
    qualityPromotionStatus: manifest.qualityEvidence?.promotionStatus || "unknown",
    checks,
    ok: Object.values(checks).every(Boolean),
  };
});

const result = {
  schemaVersion: "finetune.public-evidence-validation.v1",
  ok: reports.every((report) => report.ok),
  workflowEvidenceStatus: reports.every((report) => report.ok) ? "pass" : "failed",
  qualityPromotionStatus: reports.every((report) => report.qualityPromotionStatus === "hold") ? "hold" : "unknown",
  reports,
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
