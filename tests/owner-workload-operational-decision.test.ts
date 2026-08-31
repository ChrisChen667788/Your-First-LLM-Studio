import assert from "node:assert/strict";
import test from "node:test";

import type {
  ExternalAssuranceArtifact,
  ExternalAssuranceDefinition,
} from "@/features/experiments/external-assurance-chain";
import { buildOperationalRemediationControlPlane } from "@/features/experiments/operational-remediation-control-plane";
import {
  buildOperationalSustainabilitySourceSignalSnapshot,
  type OperationalSustainabilitySourceSignal,
  type OperationalSustainabilitySourceSignalId,
} from "@/features/experiments/operational-sustainability-source-signals";
import {
  OPERATIONAL_DECISION_GOVERNANCE_DEFINITIONS,
  buildOperationalDecisionGovernanceTrainState,
} from "@/features/experiments/operational-decision-governance-train";
import {
  OWNER_WORKLOAD_ADMISSION_DEFINITIONS,
  buildOwnerWorkloadAdmissionTrainState,
} from "@/features/experiments/owner-workload-admission-train";
import {
  buildOwnerWorkloadProtocol,
  validateOwnerWorkloadReceipt,
} from "@/features/experiments/owner-workload-protocol";
import { buildOwnerWorkloadSourceSignalSnapshot } from "@/features/experiments/owner-workload-source-signals";
import {
  buildRemediationExecutionPlan,
} from "@/features/experiments/remediation-execution-source-signals";
import {
  RELEASE_TRAIN_DEVELOPMENT_VERSION,
  RELEASE_TRAIN_MILESTONES,
} from "@/features/experiments/release-train";

const now = Date.parse("2026-08-30T12:00:00.000Z");
const digest = (character: string) => character.repeat(64);
const sourceIds: OperationalSustainabilitySourceSignalId[] = [
  "provider-traffic-reconciliation",
  "retrieval-freshness-remediation",
  "model-supply-chain-reconciliation",
  "workspace-audit-completeness",
  "runtime-recovery-efficiency",
  "agent-session-recovery",
  "workflow-queue-failover",
  "benchmark-cost-quality",
  "finetune-cost-quality-export",
  "independent-remediation-review",
  "telemetry-resource-transparency",
  "incident-diagnostics-retention",
  "admin-compatibility-sunset",
  "desktop-upgrade-data-lifecycle",
  "independent-sustainable-operations-review",
];

function executionPlan(attentionIds: OperationalSustainabilitySourceSignalId[] = []) {
  const snapshot = buildOperationalSustainabilitySourceSignalSnapshot(
    sourceIds.map((id): OperationalSustainabilitySourceSignal => {
      const externalOnly = id.startsWith("independent-");
      const attention = attentionIds.includes(id);
      return {
        id,
        label: id,
        status: externalOnly ? "external-only" : attention ? "attention" : "pass",
        summary: `${id} source evidence`,
        checks: { sourceEvidencePassing: !attention },
        metrics: {},
        blockers: attention ? [`${id} remains open.`] : [],
        evidenceUri: "/experiments",
      };
    }),
  );
  return buildRemediationExecutionPlan(buildOperationalRemediationControlPlane(snapshot));
}

function artifactsFor(
  definitions: ExternalAssuranceDefinition[],
  anchor: { version: string; digest: string; recordId: string },
) {
  return definitions.map((definition, index) => {
    const predecessor = index === 0
      ? anchor
      : {
          version: definitions[index - 1]!.version,
          digest: digest(index.toString(16)),
          recordId: `authority-record-${index - 1}`,
        };
    return {
      present: true,
      digest: digest((index + 1).toString(16)),
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
          ...(definition.finalReview
            ? {
                reviewedDigests: definitions.slice(0, index).map((_, reviewedIndex) => digest((reviewedIndex + 1).toString(16))),
                reviewDigest: digest("c"),
              }
            : {}),
        },
        issuer: {
          organizationId: `external-authority-${index}`,
          operatorId: `external-operator-${index}`,
          keyId: `external-key-${index}`,
        },
      },
    } satisfies ExternalAssuranceArtifact;
  });
}

test("owner workload protocol is deterministic, bounded, and remote-mutation denied", () => {
  const plan = executionPlan();
  const protocol = buildOwnerWorkloadProtocol(plan);
  const timeShifted = buildOwnerWorkloadProtocol({
    ...plan,
    generatedAt: "2026-08-31T12:00:00.000Z",
  });
  assert.equal(protocol.summary.totalRequests, 7);
  assert.equal(protocol.summary.completedRequests, 7);
  assert.equal(protocol.protocolDigest, timeShifted.protocolDigest);
  assert.ok(Object.values(protocol.checks).every(Boolean));
  assert.ok(protocol.requests.every((request) => request.remoteMutationAllowed === false));
  assert.equal(protocol.waiverPolicy.productionOverrideAllowed, false);
  assert.equal(protocol.productionStatus, "blocked");
});

test("strict receipt validation binds action, digest, identity, time, and evidence", () => {
  const protocol = buildOwnerWorkloadProtocol(executionPlan());
  const request = protocol.requests[0]!;
  const receipt = {
    schemaVersion: "experiments.owner-workload-receipt.v1",
    actionId: request.actionId,
    requestDigest: request.requestDigest,
    idempotencyKey: request.idempotencyKey,
    startedAt: "2026-08-30T10:00:00.000Z",
    completedAt: "2026-08-30T11:00:00.000Z",
    outcome: "passed",
    primaryEvidenceDigest: digest("a"),
    operator: {
      organizationId: "first-llm-production-ops",
      operatorId: "provider-operator-01",
    },
  };
  const valid = validateOwnerWorkloadReceipt({ receipt, protocol, now });
  const invalid = validateOwnerWorkloadReceipt({
    receipt: { ...receipt, requestDigest: digest("f"), unexpected: true },
    protocol,
    now,
  });
  assert.equal(valid.status, "valid-candidate");
  assert.equal(valid.externalSignaturePending, true);
  assert.equal(valid.productionTransitionDenied, true);
  assert.equal(invalid.status, "invalid");
  assert.equal(invalid.checks.strictTopLevelSchema, false);
  assert.equal(invalid.checks.requestDigestBound, false);
});

test("source signals keep owner completion separate from independent closure", () => {
  const snapshot = buildOwnerWorkloadSourceSignalSnapshot({
    executionPlan: executionPlan(),
    now,
  });
  assert.equal(snapshot.summary.totalSignals, 15);
  assert.equal(snapshot.summary.sourceOwnedSignals, 13);
  assert.equal(snapshot.summary.externalOnlySignals, 2);
  assert.equal(snapshot.localStatus, "pass");
  assert.match(snapshot.stateDigest, /^[a-f0-9]{64}$/u);
});

test("v3.4 verifies ten predecessor-bound records without granting production", () => {
  const anchor = {
    version: "v3.3.4",
    evidenceStatus: "verified" as const,
    digest: digest("e"),
    recordId: "operational-acceptance",
    issuerOrganizationId: "operational-authority",
  };
  const sourceSignals = buildOwnerWorkloadSourceSignalSnapshot({ executionPlan: executionPlan(), now });
  const state = buildOwnerWorkloadAdmissionTrainState({
    anchor,
    artifacts: artifactsFor(OWNER_WORKLOAD_ADMISSION_DEFINITIONS, {
      version: anchor.version,
      digest: anchor.digest,
      recordId: anchor.recordId,
    }),
    sourceSignals,
    now,
  });
  assert.equal(state.summary.verifiedVersions, 10);
  assert.equal(state.sourceSummary.sourceOwnedSignals, 9);
  assert.equal(state.sourceSummary.externalOnlySignals, 1);
  assert.equal(state.productionStatus, "blocked");
});

test("v3.5 verifies decision governance while preserving independent final authority", () => {
  const anchor = {
    version: "v3.4.9",
    evidenceStatus: "verified" as const,
    digest: digest("e"),
    recordId: "workload-receipt-closure",
    issuerOrganizationId: "workload-authority",
  };
  const sourceSignals = buildOwnerWorkloadSourceSignalSnapshot({ executionPlan: executionPlan(), now });
  const state = buildOperationalDecisionGovernanceTrainState({
    anchor,
    artifacts: artifactsFor(OPERATIONAL_DECISION_GOVERNANCE_DEFINITIONS, {
      version: anchor.version,
      digest: anchor.digest,
      recordId: anchor.recordId,
    }),
    sourceSignals,
    now,
  });
  assert.equal(state.summary.verifiedVersions, 5);
  assert.equal(state.sourceSummary.sourceOwnedSignals, 4);
  assert.equal(state.sourceSummary.externalOnlySignals, 1);
  assert.equal(state.productionStatus, "blocked");
});

test("release train exposes all fifteen v3.4-v3.5 milestones", () => {
  const versions = RELEASE_TRAIN_MILESTONES.slice(-45, -30).map((entry) => entry.version);
  assert.deepEqual(versions, [
    "v3.4.0", "v3.4.1", "v3.4.2", "v3.4.3", "v3.4.4",
    "v3.4.5", "v3.4.6", "v3.4.7", "v3.4.8", "v3.4.9",
    "v3.5.0", "v3.5.1", "v3.5.2", "v3.5.3", "v3.5.4",
  ]);
  assert.equal(RELEASE_TRAIN_MILESTONES.length, 200);
  assert.equal(RELEASE_TRAIN_DEVELOPMENT_VERSION, "v1.7.0-v3.7.4 source; v3.8.0-v3.9.4 planned");
  assert.ok(RELEASE_TRAIN_MILESTONES.slice(-45, -30).every((entry) => entry.status === "evidence-needed"));
});
