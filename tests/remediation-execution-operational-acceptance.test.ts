import assert from "node:assert/strict";
import test from "node:test";

import type {
  ExternalAssuranceArtifact,
  ExternalAssuranceDefinition,
} from "@/features/experiments/external-assurance-chain";
import {
  OPERATIONAL_ACCEPTANCE_DEFINITIONS,
  buildOperationalAcceptanceTrainState,
} from "@/features/experiments/operational-acceptance-train";
import { buildOperationalRemediationControlPlane } from "@/features/experiments/operational-remediation-control-plane";
import {
  buildOperationalSustainabilitySourceSignalSnapshot,
  type OperationalSustainabilitySourceSignal,
  type OperationalSustainabilitySourceSignalId,
} from "@/features/experiments/operational-sustainability-source-signals";
import {
  REMEDIATION_EXECUTION_DEFINITIONS,
  buildRemediationExecutionTrainState,
} from "@/features/experiments/remediation-execution-train";
import {
  buildRemediationExecutionPlan,
  buildRemediationExecutionSourceSignalSnapshot,
} from "@/features/experiments/remediation-execution-source-signals";
import {
  RELEASE_TRAIN_DEVELOPMENT_VERSION,
  RELEASE_TRAIN_MILESTONES,
} from "@/features/experiments/release-train";

const now = Date.parse("2026-08-30T00:00:00.000Z");
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

function sourceSnapshot(attentionIds: OperationalSustainabilitySourceSignalId[] = []) {
  return buildOperationalSustainabilitySourceSignalSnapshot(
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

test("remediation execution plan is deterministic, fenced, rollback-bound, and non-mutating", () => {
  const controlPlane = buildOperationalRemediationControlPlane(
    sourceSnapshot([
      "provider-traffic-reconciliation",
      "retrieval-freshness-remediation",
      "model-supply-chain-reconciliation",
      "workspace-audit-completeness",
      "runtime-recovery-efficiency",
      "benchmark-cost-quality",
      "telemetry-resource-transparency",
    ]),
  );
  const first = buildRemediationExecutionPlan(controlPlane);
  const second = buildRemediationExecutionPlan(controlPlane);
  const timeShifted = buildRemediationExecutionPlan({
    ...controlPlane,
    generatedAt: "2026-08-31T00:00:00.000Z",
    stateDigest: digest("f"),
  });
  assert.equal(first.summary.totalActions, 7);
  assert.equal(first.packageDigest, second.packageDigest);
  assert.equal(first.queueDigest, second.queueDigest);
  assert.equal(first.packageDigest, timeShifted.packageDigest);
  assert.equal(first.queueDigest, timeShifted.queueDigest);
  assert.ok(Object.values(first.checks).every(Boolean));
  assert.ok(first.actions.every((action) => action.remoteMutationAllowed === false));
  assert.ok(first.actions.every((action) => action.rollback.required));
  assert.equal(first.productionStatus, "blocked");
});

test("execution signals expose thirteen source-owned gates and two external authorities", () => {
  const snapshot = buildRemediationExecutionSourceSignalSnapshot(
    buildOperationalRemediationControlPlane(sourceSnapshot()),
  );
  assert.equal(snapshot.summary.totalSignals, 15);
  assert.equal(snapshot.summary.sourceOwnedSignals, 13);
  assert.equal(snapshot.summary.externalOnlySignals, 2);
  assert.equal(snapshot.remediationExecutionPlan.summary.satisfiedActions, 7);
  assert.equal(snapshot.localStatus, "pass");
  assert.match(snapshot.stateDigest, /^[a-f0-9]{64}$/u);
});

test("v3.2 verifies ten predecessor-bound records without granting production", () => {
  const anchor = {
    version: "v3.1.4",
    evidenceStatus: "verified" as const,
    digest: digest("e"),
    recordId: "service-readiness-closure",
    issuerOrganizationId: "service-readiness-authority",
  };
  const sourceSignals = buildRemediationExecutionSourceSignalSnapshot(
    buildOperationalRemediationControlPlane(sourceSnapshot()),
  );
  const state = buildRemediationExecutionTrainState({
    anchor,
    artifacts: artifactsFor(REMEDIATION_EXECUTION_DEFINITIONS, {
      version: anchor.version,
      digest: anchor.digest,
      recordId: anchor.recordId,
    }),
    sourceSignals,
    now,
  });
  assert.equal(state.summary.verifiedVersions, 10);
  assert.equal(state.summary.chainComplete, true);
  assert.equal(state.sourceSummary.sourceOwnedSignals, 9);
  assert.equal(state.productionStatus, "blocked");
});

test("v3.3 binds execution acceptance and preserves independent final authority", () => {
  const anchor = {
    version: "v3.2.9",
    evidenceStatus: "verified" as const,
    digest: digest("e"),
    recordId: "execution-acceptance",
    issuerOrganizationId: "execution-authority",
  };
  const sourceSignals = buildRemediationExecutionSourceSignalSnapshot(
    buildOperationalRemediationControlPlane(sourceSnapshot()),
  );
  const state = buildOperationalAcceptanceTrainState({
    anchor,
    artifacts: artifactsFor(OPERATIONAL_ACCEPTANCE_DEFINITIONS, {
      version: anchor.version,
      digest: anchor.digest,
      recordId: anchor.recordId,
    }),
    sourceSignals,
    now,
  });
  assert.equal(state.summary.verifiedVersions, 5);
  assert.equal(state.summary.chainComplete, true);
  assert.equal(state.sourceSummary.sourceOwnedSignals, 4);
  assert.equal(state.sourceSummary.externalOnlySignals, 1);
  assert.equal(state.productionStatus, "blocked");
});

test("missing execution predecessor and incomplete owner actions remain fail closed", () => {
  const sourceSignals = buildRemediationExecutionSourceSignalSnapshot(
    buildOperationalRemediationControlPlane(sourceSnapshot(["provider-traffic-reconciliation"])),
  );
  const state = buildOperationalAcceptanceTrainState({
    anchor: {
      version: "v3.2.9",
      evidenceStatus: "missing",
      digest: null,
      recordId: null,
      issuerOrganizationId: null,
    },
    artifacts: OPERATIONAL_ACCEPTANCE_DEFINITIONS.map(() => ({ present: false })),
    sourceSignals,
    now,
  });
  assert.equal(state.summary.verifiedVersions, 0);
  assert.equal(state.summary.chainComplete, false);
  assert.equal(state.localStatus, "attention");
  assert.equal(state.productionStatus, "blocked");
});

test("release train exposes all fifteen v3.2-v3.3 milestones", () => {
  const versions = RELEASE_TRAIN_MILESTONES.slice(-60, -45).map((entry) => entry.version);
  assert.deepEqual(versions, [
    "v3.2.0", "v3.2.1", "v3.2.2", "v3.2.3", "v3.2.4",
    "v3.2.5", "v3.2.6", "v3.2.7", "v3.2.8", "v3.2.9",
    "v3.3.0", "v3.3.1", "v3.3.2", "v3.3.3", "v3.3.4",
  ]);
  assert.equal(RELEASE_TRAIN_MILESTONES.length, 200);
  assert.equal(RELEASE_TRAIN_DEVELOPMENT_VERSION, "v1.7.0-v3.7.4 source; v3.8.0-v3.9.4 planned");
  assert.ok(RELEASE_TRAIN_MILESTONES.slice(-60, -45).every((entry) => entry.status === "evidence-needed"));
});
