import assert from "node:assert/strict";
import test from "node:test";

import { buildReproducibleTrainingRecipeState } from "@/features/finetune/reproducible-training-recipe-evidence";

function fixture(hasQualityPackage = true) {
  return {
    training: {
      totals: { implemented: 1 },
      sampleCompatibility: { supported: true },
    },
    execution: {
      sample: { executionMode: "worker-ready" },
    },
    quality: {
      localStatus: hasQualityPackage ? "pass" : "evidence-needed",
      latest: hasQualityPackage
        ? {
            localStatus: "pass",
            quality: { decision: "promote" },
            package: { readBackVerified: true, rollbackVerified: true },
          }
        : null,
    },
    rehearsal: {
      id: "recipe-rehearsal-1",
      generatedAt: "2026-08-21T00:00:00.000Z",
      recipeDigest: "sha256:fixture",
      pins: {
        baseModelDigest: "a".repeat(64),
        datasetDigest: "b".repeat(64),
        runtimeDigest: "c".repeat(64),
        evaluatorDigest: "d".repeat(64),
      },
      checks: {
        canonicalRoundTrip: true,
        inputsPinned: true,
        implementedPlanWorkerReady: true,
        unsupportedConfigurationRejected: true,
        argvIsStructured: true,
        remoteReadBackPlanned: true,
      },
    },
    now: Date.parse("2026-08-21T01:00:00.000Z"),
  };
}

test("reproducible training recipes require canonical pins, fail-closed preflight, and package read-back", () => {
  const state = buildReproducibleTrainingRecipeState(
    fixture() as Parameters<typeof buildReproducibleTrainingRecipeState>[0],
  );
  assert.equal(state.localStatus, "pass");
  assert.equal(state.productionStatus, "hold");
  assert.equal(state.checks.unsupportedConfigurationFailsClosed, true);
  assert.equal(state.checks.packageReadBackBound, true);
});

test("a canonical recipe rehearsal cannot stand in for quality package evidence", () => {
  const state = buildReproducibleTrainingRecipeState(
    fixture(false) as Parameters<typeof buildReproducibleTrainingRecipeState>[0],
  );
  assert.equal(state.localStatus, "hold");
  assert.equal(state.checks.recipeRoundTripCanonical, true);
  assert.equal(state.checks.qualityEvidenceBound, false);
  assert.equal(state.checks.packageReadBackBound, false);
});
