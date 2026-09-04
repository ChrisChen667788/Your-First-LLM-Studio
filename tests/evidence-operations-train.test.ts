import assert from "node:assert/strict";
import test from "node:test";

import {
  OPERATIONAL_EVIDENCE_RECEIPT_SCHEMA_VERSION,
  validateOperationalEvidenceReceipt,
} from "@/features/evidence/operational-receipts";
import {
  readEvidenceOperationSpecs,
  readEvidenceOperationsTrainEvidence,
} from "@/features/experiments/evidence-operations-train";

const now = new Date("2026-09-03T04:00:00.000Z");
const digest = "a".repeat(64);

function validReceipt(version: string, metrics: Record<string, number>) {
  return {
    schemaVersion: OPERATIONAL_EVIDENCE_RECEIPT_SCHEMA_VERSION,
    milestone: version,
    subjectId: "observed-workload-001",
    environment: "local" as const,
    workloadDigest: digest,
    artifactDigests: [digest],
    startedAt: "2026-09-03T03:00:00.000Z",
    completedAt: "2026-09-03T03:10:00.000Z",
    outcome: "pass" as const,
    metrics,
    operator: { organizationId: "studio-org", operatorId: "operator-001" },
  };
}

test("evidence operations train owns exactly fifteen source contracts", () => {
  const evidence = readEvidenceOperationsTrainEvidence();
  assert.equal(evidence.versions.length, 15);
  assert.equal(evidence.totals.sourcePassed, 15);
  assert.equal(evidence.externalStatus, "hold");
  assert.equal(evidence.productionStatus, "blocked");
  assert.ok(evidence.versions.every((version) => version.sourceStatus === "pass"));
});

test("every evidence operation declares metrics and an owner boundary", () => {
  const specs = readEvidenceOperationSpecs();
  assert.equal(specs.length, 15);
  assert.ok(specs.every((spec) => spec.requiredMetrics.length > 0));
  assert.ok(specs.every((spec) => spec.owner.startsWith("features/")));
  assert.equal(new Set(specs.map((spec) => spec.version)).size, 15);
});

test("strict candidate validation accepts a current complete receipt", () => {
  const spec = readEvidenceOperationSpecs().find((entry) => entry.version === "v4.0.0");
  assert.ok(spec);
  const receipt = validReceipt("v4.0.0", {
    advertisedModelCount: 3,
    probeLatencyMs: 120,
  });
  const validation = validateOperationalEvidenceReceipt({ receipt, spec, now });
  assert.equal(validation.ok, true);
  assert.equal(validation.externalSignaturePending, true);
  assert.equal(validation.productionTransitionDenied, true);
});

test("candidate validation rejects missing required metrics", () => {
  const spec = readEvidenceOperationSpecs().find((entry) => entry.version === "v4.0.1");
  assert.ok(spec);
  const receipt = validReceipt("v4.0.1", { sampleCount: 20 });
  const validation = validateOperationalEvidenceReceipt({ receipt, spec, now });
  assert.equal(validation.ok, false);
  assert.equal(validation.checks.requiredMetrics, false);
});

test("candidate validation rejects placeholder operator identities", () => {
  const spec = readEvidenceOperationSpecs().find((entry) => entry.version === "v4.0.2");
  assert.ok(spec);
  const receipt = {
    ...validReceipt("v4.0.2", {
      shadowRequests: 20,
      fallbackReplays: 20,
      decisionMatches: 20,
    }),
    operator: { organizationId: "fixture-org", operatorId: "test-user" },
  };
  const validation = validateOperationalEvidenceReceipt({ receipt, spec, now });
  assert.equal(validation.ok, false);
  assert.equal(validation.checks.durableOperator, false);
});

test("candidate validation rejects stale evidence", () => {
  const spec = readEvidenceOperationSpecs().find((entry) => entry.version === "v4.0.3");
  assert.ok(spec);
  const receipt = {
    ...validReceipt("v4.0.3", { scenarios: 10, passed: 10, duplicateEffects: 0 }),
    startedAt: "2026-08-01T03:00:00.000Z",
    completedAt: "2026-08-01T03:10:00.000Z",
  };
  const validation = validateOperationalEvidenceReceipt({ receipt, spec, now });
  assert.equal(validation.ok, false);
  assert.equal(validation.checks.fresh, false);
});

test("candidate validation rejects unknown top-level fields", () => {
  const spec = readEvidenceOperationSpecs().find((entry) => entry.version === "v4.0.4");
  assert.ok(spec);
  const receipt = {
    ...validReceipt("v4.0.4", {
      requests: 10,
      cacheHits: 4,
      cachedTokens: 100,
      billedTokens: 200,
    }),
    apiKey: "must-not-be-accepted",
  };
  const validation = validateOperationalEvidenceReceipt({ receipt, spec, now });
  assert.equal(validation.ok, false);
  assert.equal(validation.checks.strictTopLevelSchema, false);
});

test("aggregate promotion cannot pass before all domain operations pass", () => {
  const evidence = readEvidenceOperationsTrainEvidence();
  const promotion = evidence.versions.find((version) => version.version === "v4.1.4");
  assert.ok(promotion);
  if (evidence.totals.localPassed < 15) assert.equal(promotion.localStatus, "hold");
});
