import assert from "node:assert/strict";
import test from "node:test";

import type {
  ExternalAssuranceArtifact,
  ExternalAssuranceDefinition,
} from "@/features/experiments/external-assurance-chain";
import {
  buildOperationalRemediationControlPlane,
} from "@/features/experiments/operational-remediation-control-plane";
import {
  buildOperationalSustainabilitySourceSignalSnapshot,
  type OperationalSustainabilitySourceSignal,
  type OperationalSustainabilitySourceSignalId,
} from "@/features/experiments/operational-sustainability-source-signals";
import {
  REMEDIATION_CONTROL_DEFINITIONS,
  buildRemediationControlTrainState,
} from "@/features/experiments/remediation-control-train";
import {
  buildServiceReadinessSourceSignalSnapshot,
} from "@/features/experiments/service-readiness-source-signals";
import {
  SERVICE_READINESS_DEFINITIONS,
  buildServiceReadinessTrainState,
} from "@/features/experiments/service-readiness-train";
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
          ...(definition.requireSecondaryDigest
            ? { secondaryEvidenceDigest: digest("b") }
            : {}),
          observationWindowHours: definition.minObservationWindowHours,
          coveragePct: definition.minimumCoveragePct,
          unresolvedCriticalFindings: 0,
          assertions: definition.requiredAssertions,
          ...(definition.finalReview
            ? {
                reviewedDigests: definitions
                  .slice(0, index)
                  .map((_, reviewedIndex) => digest((reviewedIndex + 1).toString(16))),
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

test("remediation control plane covers every owner signal with an acyclic policy graph", () => {
  const controlPlane = buildOperationalRemediationControlPlane(
    sourceSnapshot([
      "provider-traffic-reconciliation",
      "model-supply-chain-reconciliation",
    ]),
  );
  assert.equal(controlPlane.summary.totalItems, 15);
  assert.equal(controlPlane.topologicalOrder.length, 15);
  assert.ok(Object.values(controlPlane.checks).every(Boolean));
  assert.equal(controlPlane.localStatus, "attention");
  assert.match(controlPlane.stateDigest, /^[a-f0-9]{64}$/u);
  assert.ok(controlPlane.items.every((item) => item.acceptanceChecks.length > 0));
  assert.ok(controlPlane.items.every((item) => item.nextActions.length > 0));
  assert.equal(
    controlPlane.items.find((item) => item.sourceSignalId === "runtime-recovery-efficiency")?.state,
    "blocked",
  );
});

test("service readiness projection preserves seven open controls and two external authorities", () => {
  const service = buildServiceReadinessSourceSignalSnapshot(
    buildOperationalRemediationControlPlane(
      sourceSnapshot([
        "provider-traffic-reconciliation",
        "retrieval-freshness-remediation",
        "model-supply-chain-reconciliation",
        "workspace-audit-completeness",
        "runtime-recovery-efficiency",
        "benchmark-cost-quality",
        "telemetry-resource-transparency",
      ]),
    ),
  );
  assert.equal(service.summary.totalSignals, 15);
  assert.equal(service.summary.sourceOwnedSignals, 13);
  assert.equal(service.summary.passingSignals, 5);
  assert.equal(service.summary.attentionSignals, 8);
  assert.equal(service.summary.externalOnlySignals, 2);
  assert.equal(service.localStatus, "attention");
});

test("v3.0 verifies ten external records without granting production", () => {
  const anchor = {
    version: "v2.9.4",
    evidenceStatus: "verified" as const,
    digest: digest("e"),
    recordId: "sustainable-operations-closure",
    issuerOrganizationId: "sustainable-operations-authority",
  };
  const sourceSignals = buildServiceReadinessSourceSignalSnapshot(
    buildOperationalRemediationControlPlane(sourceSnapshot()),
  );
  const state = buildRemediationControlTrainState({
    anchor,
    artifacts: artifactsFor(REMEDIATION_CONTROL_DEFINITIONS, {
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

test("v3.1 binds the independent v3.0 acceptance and remains fail-closed", () => {
  const anchor = {
    version: "v3.0.9",
    evidenceStatus: "verified" as const,
    digest: digest("e"),
    recordId: "remediation-control-acceptance",
    issuerOrganizationId: "remediation-control-authority",
  };
  const sourceSignals = buildServiceReadinessSourceSignalSnapshot(
    buildOperationalRemediationControlPlane(sourceSnapshot()),
  );
  const state = buildServiceReadinessTrainState({
    anchor,
    artifacts: artifactsFor(SERVICE_READINESS_DEFINITIONS, {
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

test("missing v3.0 predecessor and local attention remain visible", () => {
  const sourceSignals = buildServiceReadinessSourceSignalSnapshot(
    buildOperationalRemediationControlPlane(
      sourceSnapshot(["provider-traffic-reconciliation"]),
    ),
  );
  const state = buildServiceReadinessTrainState({
    anchor: {
      version: "v3.0.9",
      evidenceStatus: "missing",
      digest: null,
      recordId: null,
      issuerOrganizationId: null,
    },
    artifacts: SERVICE_READINESS_DEFINITIONS.map(() => ({ present: false })),
    sourceSignals,
    now,
  });
  assert.equal(state.summary.verifiedVersions, 0);
  assert.equal(state.summary.chainComplete, false);
  assert.equal(state.localStatus, "attention");
  assert.equal(state.productionStatus, "blocked");
});

test("release train exposes all fifteen v3.0-v3.1 milestones", () => {
  const versions = RELEASE_TRAIN_MILESTONES.slice(-15).map((entry) => entry.version);
  assert.deepEqual(versions, [
    "v3.0.0", "v3.0.1", "v3.0.2", "v3.0.3", "v3.0.4",
    "v3.0.5", "v3.0.6", "v3.0.7", "v3.0.8", "v3.0.9",
    "v3.1.0", "v3.1.1", "v3.1.2", "v3.1.3", "v3.1.4",
  ]);
  assert.equal(RELEASE_TRAIN_MILESTONES.length, 140);
  assert.equal(
    RELEASE_TRAIN_DEVELOPMENT_VERSION,
    "v1.7.0-v3.1.4 source and evidence trains",
  );
  assert.ok(
    RELEASE_TRAIN_MILESTONES.slice(-15).every(
      (entry) => entry.status === "evidence-needed",
    ),
  );
});
