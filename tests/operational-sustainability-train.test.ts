import assert from "node:assert/strict";
import test from "node:test";

import type {
  ExternalAssuranceArtifact,
  ExternalAssuranceDefinition,
} from "@/features/experiments/external-assurance-chain";
import {
  OPERATIONAL_REMEDIATION_EFFICIENCY_DEFINITIONS,
  buildOperationalRemediationEfficiencyState,
} from "@/features/experiments/operational-remediation-efficiency-train";
import {
  buildOperationalSustainabilitySourceSignalSnapshot,
  type OperationalSustainabilitySourceSignal,
  type OperationalSustainabilitySourceSignalId,
} from "@/features/experiments/operational-sustainability-source-signals";
import {
  SUSTAINABLE_OPERATIONS_UPGRADE_DEFINITIONS,
  buildSustainableOperationsUpgradeState,
} from "@/features/experiments/sustainable-operations-upgrade-train";
import {
  RELEASE_TRAIN_DEVELOPMENT_VERSION,
  RELEASE_TRAIN_MILESTONES,
} from "@/features/experiments/release-train";

const now = Date.parse("2026-08-30T00:00:00.000Z");
const digest = (character: string) => character.repeat(64);

function artifactsFor(
  definitions: ExternalAssuranceDefinition[],
  anchor: { version: string; digest: string; recordId: string },
) {
  return definitions.map((definition, index) => {
    const marker = (index + 1).toString(16);
    const predecessor = index === 0
      ? anchor
      : { version: definitions[index - 1]!.version, digest: digest(index.toString(16)), recordId: `authority-record-${index - 1}` };
    return {
      present: true,
      digest: digest(marker),
      signatureVerified: true,
      trustAnchorPinned: true,
      payload: {
        schemaVersion: definition.schemaVersion,
        recordId: `authority-record-${index}`,
        generatedAt: "2026-08-29T00:00:00.000Z",
        expiresAt: "2026-10-30T00:00:00.000Z",
        predecessor,
        control: {
          status: "passed",
          primaryEvidenceDigest: digest("a"),
          ...(definition.requireSecondaryDigest ? { secondaryEvidenceDigest: digest("b") } : {}),
          observationWindowHours: definition.minObservationWindowHours,
          coveragePct: definition.minimumCoveragePct,
          unresolvedCriticalFindings: 0,
          assertions: definition.requiredAssertions,
          ...(definition.finalReview ? { reviewedDigests: definitions.slice(0, index).map((_, reviewedIndex) => digest((reviewedIndex + 1).toString(16))), reviewDigest: digest("c") } : {}),
        },
        issuer: { organizationId: `external-authority-${index}`, operatorId: `external-operator-${index}`, keyId: `external-key-${index}` },
      },
    } satisfies ExternalAssuranceArtifact;
  });
}

const signalIds: OperationalSustainabilitySourceSignalId[] = [
  "provider-traffic-reconciliation", "retrieval-freshness-remediation", "model-supply-chain-reconciliation", "workspace-audit-completeness", "runtime-recovery-efficiency", "agent-session-recovery", "workflow-queue-failover", "benchmark-cost-quality", "finetune-cost-quality-export", "independent-remediation-review", "telemetry-resource-transparency", "incident-diagnostics-retention", "admin-compatibility-sunset", "desktop-upgrade-data-lifecycle", "independent-sustainable-operations-review",
];

function sourceSignals(attentionIds: OperationalSustainabilitySourceSignalId[] = []) {
  return buildOperationalSustainabilitySourceSignalSnapshot(
    signalIds.map((id): OperationalSustainabilitySourceSignal => {
      const externalOnly = id.startsWith("independent-");
      const attention = attentionIds.includes(id);
      return { id, label: id, status: externalOnly ? "external-only" : attention ? "attention" : "pass", summary: `${id} source signal`, checks: { sourceContractPresent: !attention }, metrics: {}, blockers: attention ? [`${id} needs remediation.`] : [], evidenceUri: "/experiments" };
    }),
  );
}

test("operational sustainability signals preserve source and external boundaries", () => {
  const complete = sourceSignals();
  assert.equal(complete.summary.totalSignals, 15);
  assert.equal(complete.summary.sourceOwnedSignals, 13);
  assert.equal(complete.summary.passingSignals, 13);
  assert.equal(complete.summary.externalOnlySignals, 2);
  assert.equal(complete.localStatus, "pass");
  assert.equal(sourceSignals(["retrieval-freshness-remediation"]).localStatus, "attention");
});

test("v2.8 verifies ten external records without granting production", () => {
  const anchor = { version: "v2.7.4", evidenceStatus: "verified" as const, digest: digest("e"), recordId: "interoperability-closure", issuerOrganizationId: "interoperability-authority" };
  const state = buildOperationalRemediationEfficiencyState({
    anchor,
    artifacts: artifactsFor(OPERATIONAL_REMEDIATION_EFFICIENCY_DEFINITIONS, { version: anchor.version, digest: anchor.digest, recordId: anchor.recordId }),
    sourceSignals: sourceSignals(),
    now,
  });
  assert.equal(state.summary.verifiedVersions, 10);
  assert.equal(state.summary.chainComplete, true);
  assert.equal(state.sourceSummary.sourceOwnedSignals, 9);
  assert.equal(state.localStatus, "pass");
  assert.equal(state.productionStatus, "blocked");
});

test("v2.8 local readiness follows the selected feature-owned signals", () => {
  const anchor = { version: "v2.7.4", evidenceStatus: "missing" as const, digest: null, recordId: null, issuerOrganizationId: null };
  const state = buildOperationalRemediationEfficiencyState({ anchor, artifacts: OPERATIONAL_REMEDIATION_EFFICIENCY_DEFINITIONS.map(() => ({ present: false })), sourceSignals: sourceSignals(["provider-traffic-reconciliation"]), now });
  assert.equal(state.localStatus, "attention");
  assert.equal(state.sourceSummary.attentionSignals, 1);
  assert.equal(state.summary.verifiedVersions, 0);
  assert.equal(state.productionStatus, "blocked");
});

test("v2.9 binds the v2.8 terminal review and requires a distinct final reviewer", () => {
  const anchor = { version: "v2.8.9", evidenceStatus: "verified" as const, digest: digest("e"), recordId: "remediation-review", issuerOrganizationId: "remediation-authority" };
  const state = buildSustainableOperationsUpgradeState({
    anchor,
    artifacts: artifactsFor(SUSTAINABLE_OPERATIONS_UPGRADE_DEFINITIONS, { version: anchor.version, digest: anchor.digest, recordId: anchor.recordId }),
    sourceSignals: sourceSignals(),
    now,
  });
  assert.equal(state.summary.verifiedVersions, 5);
  assert.equal(state.sourceSummary.sourceOwnedSignals, 4);
  assert.equal(state.sourceSummary.externalOnlySignals, 1);
  assert.equal(state.summary.chainComplete, true);
  assert.equal(state.productionStatus, "blocked");
});

test("v2.9 fails closed when its predecessor is unavailable", () => {
  const state = buildSustainableOperationsUpgradeState({
    anchor: { version: "v2.8.9", evidenceStatus: "missing", digest: null, recordId: null, issuerOrganizationId: null },
    artifacts: SUSTAINABLE_OPERATIONS_UPGRADE_DEFINITIONS.map(() => ({ present: false })),
    sourceSignals: sourceSignals(["telemetry-resource-transparency"]),
    now,
  });
  assert.equal(state.summary.verifiedVersions, 0);
  assert.equal(state.summary.chainComplete, false);
  assert.equal(state.localStatus, "attention");
  assert.equal(state.productionStatus, "blocked");
});

test("release train exposes all fifteen v2.8-v2.9 evidence milestones", () => {
  const versions = RELEASE_TRAIN_MILESTONES.slice(-90, -75).map((entry) => entry.version);
  assert.deepEqual(versions, [
    "v2.8.0", "v2.8.1", "v2.8.2", "v2.8.3", "v2.8.4", "v2.8.5", "v2.8.6", "v2.8.7", "v2.8.8", "v2.8.9", "v2.9.0", "v2.9.1", "v2.9.2", "v2.9.3", "v2.9.4",
  ]);
  assert.equal(RELEASE_TRAIN_MILESTONES.length, 200);
  assert.equal(RELEASE_TRAIN_DEVELOPMENT_VERSION, "v1.7.0-v3.7.4 source; v3.8.0-v3.9.4 planned");
  assert.ok(RELEASE_TRAIN_MILESTONES.slice(-90, -75).every((entry) => entry.status === "evidence-needed"));
});
