import {
  readExternalAssuranceArtifact,
  type ExternalAssuranceArtifact,
} from "@/features/experiments/external-assurance-chain";
import {
  readRemediationExecutionSourceSignals,
  type RemediationExecutionSourceSignalId,
  type RemediationExecutionSourceSignalSnapshot,
} from "@/features/experiments/remediation-execution-source-signals";
import { readRemediationExecutionTrain } from "@/features/experiments/remediation-execution-train";
import {
  buildSourceBackedAssuranceProjection,
  type SourceBackedAssuranceDefinition,
} from "@/features/experiments/source-backed-assurance-projection";

export const OPERATIONAL_ACCEPTANCE_TRAIN_SCHEMA_VERSION =
  "experiments.operational-acceptance-train.v1" as const;

export const OPERATIONAL_ACCEPTANCE_DEFINITIONS: Array<
  SourceBackedAssuranceDefinition<RemediationExecutionSourceSignalId>
> = [
  {
    version: "v3.3.0",
    key: "SLO_QUALITY_ACCEPTANCE_POLICY",
    label: "SLO and Quality Acceptance Policy",
    schemaVersion: "enterprise.operational-acceptance-slo-quality.v1",
    sourceSignalId: "slo-quality-acceptance-policy",
    sourceContracts: ["all seven owner actions satisfied", "quality, latency, error, and cost decision boundaries", "production authority remains denied"],
    externalBlocker: "Service, quality, finance, and product owners must approve workload-specific SLO and promotion thresholds.",
    requiredAssertions: ["slo-quality-policy-approved", "slo-quality-policy-retained"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 95,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.3.1",
    key: "INCIDENT_CHANGE_REHEARSAL",
    label: "Incident and Change Rehearsal",
    schemaVersion: "enterprise.operational-acceptance-incident-change.v1",
    sourceSignalId: "incident-change-rehearsal",
    sourceContracts: ["support diagnostic replay", "upgrade, rollback, restore, and purge", "privacy-safe retention and export"],
    externalBlocker: "Support, SRE, release, privacy, and clean-machine owners must repeat representative incident and change scenarios.",
    requiredAssertions: ["incident-change-rehearsed", "incident-change-recovery-approved"],
    minObservationWindowHours: 720,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.3.2",
    key: "OWNER_SIGNOFF_QUEUE",
    label: "Owner Sign-off Queue",
    schemaVersion: "enterprise.operational-acceptance-owner-signoff.v1",
    sourceSignalId: "owner-signoff-queue",
    sourceContracts: ["owner and priority per action", "dependency, lease, rollback, and evidence visibility", "no self-approval or remote mutation"],
    externalBlocker: "Named accountable owners must sign their actions through organization-controlled identity and archive systems.",
    requiredAssertions: ["owner-signoffs-complete", "owner-identities-verified"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.3.3",
    key: "RELEASE_READINESS_DECISION",
    label: "Release Readiness Decision",
    schemaVersion: "enterprise.operational-acceptance-release-decision.v1",
    sourceSignalId: "release-readiness-decision",
    sourceContracts: ["source remediation completion", "ordered external evidence chain", "explicit hold, approve, or reject decision"],
    externalBlocker: "Release, security, privacy, quality, finance, and support authorities must make and retain the distribution decision.",
    requiredAssertions: ["release-readiness-decided", "release-decision-retained"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.3.4",
    key: "INDEPENDENT_OPERATIONAL_ACCEPTANCE",
    label: "Independent Operational Acceptance",
    schemaVersion: "enterprise.operational-acceptance-independent-final.v1",
    sourceSignalId: "independent-operational-acceptance",
    sourceContracts: ["ordered v3.3.0-v3.3.3 evidence", "distinct operational acceptance authority", "immutable predecessor-bound terminal archive"],
    externalBlocker: "A distinct operating authority must accept and retain the complete operational package outside the Studio.",
    requiredAssertions: ["operational-acceptance-reviewed", "operational-acceptance-retained"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
    finalReview: true,
  },
];

export function buildOperationalAcceptanceTrainState(input: {
  anchor: Parameters<typeof buildSourceBackedAssuranceProjection>[0]["anchor"];
  artifacts: ExternalAssuranceArtifact[];
  sourceSignals: RemediationExecutionSourceSignalSnapshot;
  now: number;
}) {
  return buildSourceBackedAssuranceProjection({
    definitions: OPERATIONAL_ACCEPTANCE_DEFINITIONS,
    ...input,
  });
}

export function readOperationalAcceptanceTrain() {
  const predecessor = readRemediationExecutionTrain();
  const anchor = predecessor.versions.find((version) => version.version === "v3.2.9");
  const artifacts = OPERATIONAL_ACCEPTANCE_DEFINITIONS.map((definition) =>
    readExternalAssuranceArtifact(`FIRST_LLM_OPERATIONAL_ACCEPTANCE_${definition.key}`),
  );
  const sourceSignals = readRemediationExecutionSourceSignals();
  return {
    ok: true as const,
    schemaVersion: OPERATIONAL_ACCEPTANCE_TRAIN_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...buildOperationalAcceptanceTrainState({
      anchor: {
        version: "v3.2.9",
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
    remediationExecutionPlan: sourceSignals.remediationExecutionPlan,
    configuredVersions: OPERATIONAL_ACCEPTANCE_DEFINITIONS.filter((_, index) => artifacts[index]?.present).map((definition) => definition.version),
  };
}
