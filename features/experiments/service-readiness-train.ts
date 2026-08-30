import {
  readExternalAssuranceArtifact,
  type ExternalAssuranceArtifact,
} from "@/features/experiments/external-assurance-chain";
import {
  readRemediationControlTrain,
} from "@/features/experiments/remediation-control-train";
import {
  readServiceReadinessSourceSignals,
  type ServiceReadinessSourceSignalId,
  type ServiceReadinessSourceSignalSnapshot,
} from "@/features/experiments/service-readiness-source-signals";
import {
  buildSourceBackedAssuranceProjection,
  type SourceBackedAssuranceDefinition,
} from "@/features/experiments/source-backed-assurance-projection";

export const SERVICE_READINESS_TRAIN_SCHEMA_VERSION =
  "experiments.service-readiness-train.v1" as const;

export const SERVICE_READINESS_DEFINITIONS: Array<
  SourceBackedAssuranceDefinition<ServiceReadinessSourceSignalId>
> = [
  {
    version: "v3.1.0",
    key: "SERVICE_READINESS_DISCLOSURE",
    label: "Customer Service-readiness Disclosure",
    schemaVersion: "enterprise.service-readiness-disclosure.v1",
    sourceSignalId: "service-readiness-disclosure",
    sourceContracts: ["source, local, external, distribution, and production truth", "unresolved remediation counts", "audience-safe evidence links"],
    externalBlocker: "Customer, legal, security, and product owners must approve audience, claims, limitations, and support commitments.",
    requiredAssertions: ["service-readiness-disclosed", "service-limitations-approved"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.1.1",
    key: "SUPPORT_DIAGNOSTICS_READINESS",
    label: "Support Diagnostics Readiness",
    schemaVersion: "enterprise.service-readiness-support-diagnostics.v1",
    sourceSignalId: "support-diagnostics-readiness",
    sourceContracts: ["connection and provider diagnostics", "service degradation and recovery", "redacted retention, export, and replay"],
    externalBlocker: "Support, SRE, privacy, and customer owners must replay representative incidents and approve escalation and retention.",
    requiredAssertions: ["support-diagnostics-replayed", "support-escalation-approved"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 95,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.1.2",
    key: "UPGRADE_CHANGE_READINESS",
    label: "Upgrade and Change Readiness",
    schemaVersion: "enterprise.service-readiness-upgrade-change.v1",
    sourceSignalId: "upgrade-change-readiness",
    sourceContracts: ["compatibility sunset and zero-traffic evidence", "signed staged update and rollback", "data migration, restore, uninstall, and purge"],
    externalBlocker: "Apple release, change, support, privacy, and clean-machine owners must approve and repeat the representative upgrade path.",
    requiredAssertions: ["upgrade-change-rehearsed", "upgrade-rollback-approved"],
    minObservationWindowHours: 720,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.1.3",
    key: "OPERATIONAL_TRANSITION_BOARD",
    label: "Operational Transition Board",
    schemaVersion: "enterprise.service-readiness-transition-board.v1",
    sourceSignalId: "operational-transition-board",
    sourceContracts: ["owner, priority, state, and blocked-by visibility", "ordered acceptance and next actions", "explicit production denial"],
    externalBlocker: "Operations, support, product, security, privacy, and finance owners must approve accountable transition decisions.",
    requiredAssertions: ["operational-transition-reviewed", "operational-owners-accepted"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.1.4",
    key: "INDEPENDENT_SERVICE_READINESS_CLOSURE",
    label: "Independent Service-readiness Closure",
    schemaVersion: "enterprise.service-readiness-independent-closure.v1",
    sourceSignalId: "independent-service-readiness-closure",
    sourceContracts: ["ordered v3.1.0-v3.1.3 evidence", "distinct service and assurance reviewers", "immutable predecessor-bound closure"],
    externalBlocker: "A distinct service assurance authority must sign and retain the complete readiness package outside the Studio.",
    requiredAssertions: ["service-readiness-reviewed", "service-readiness-retained"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
    finalReview: true,
  },
];

export function buildServiceReadinessTrainState(input: {
  anchor: Parameters<typeof buildSourceBackedAssuranceProjection>[0]["anchor"];
  artifacts: ExternalAssuranceArtifact[];
  sourceSignals: ServiceReadinessSourceSignalSnapshot;
  now: number;
}) {
  return buildSourceBackedAssuranceProjection({
    definitions: SERVICE_READINESS_DEFINITIONS,
    ...input,
  });
}

export function readServiceReadinessTrain() {
  const predecessor = readRemediationControlTrain();
  const anchor = predecessor.versions.find((version) => version.version === "v3.0.9");
  const artifacts = SERVICE_READINESS_DEFINITIONS.map((definition) =>
    readExternalAssuranceArtifact(`FIRST_LLM_SERVICE_READINESS_${definition.key}`),
  );
  const sourceSignals = readServiceReadinessSourceSignals();
  return {
    ok: true as const,
    schemaVersion: SERVICE_READINESS_TRAIN_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...buildServiceReadinessTrainState({
      anchor: {
        version: "v3.0.9",
        evidenceStatus: anchor?.evidenceStatus || "missing",
        digest: anchor?.digest || null,
        recordId: anchor?.recordId || null,
        issuerOrganizationId: anchor?.issuerOrganizationId || null,
      },
      artifacts,
      sourceSignals,
      now: Date.now(),
    }),
    remediationControlPlane: sourceSignals.remediationControlPlane,
    configuredVersions: SERVICE_READINESS_DEFINITIONS.filter(
      (_, index) => artifacts[index]?.present,
    ).map((definition) => definition.version),
  };
}
