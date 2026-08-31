import {
  readExternalAssuranceArtifact,
  type ExternalAssuranceArtifact,
} from "@/features/experiments/external-assurance-chain";
import { readOwnerWorkloadAdmissionTrain } from "@/features/experiments/owner-workload-admission-train";
import {
  readOwnerWorkloadSourceSignals,
  type OwnerWorkloadSourceSignalId,
  type OwnerWorkloadSourceSignalSnapshot,
} from "@/features/experiments/owner-workload-source-signals";
import {
  buildSourceBackedAssuranceProjection,
  type SourceBackedAssuranceDefinition,
} from "@/features/experiments/source-backed-assurance-projection";

export const OPERATIONAL_DECISION_GOVERNANCE_TRAIN_SCHEMA_VERSION =
  "experiments.operational-decision-governance-train.v1" as const;

export const OPERATIONAL_DECISION_GOVERNANCE_DEFINITIONS: Array<
  SourceBackedAssuranceDefinition<OwnerWorkloadSourceSignalId>
> = [
  {
    version: "v3.5.0", key: "EVIDENCE_FRESHNESS_AND_DRIFT", label: "Evidence Freshness and Drift",
    schemaVersion: "enterprise.operational-decision-freshness-drift.v1", sourceSignalId: "evidence-freshness-and-drift",
    sourceContracts: ["request digest drift detection", "bounded receipt freshness", "stale evidence blocks promotion"],
    externalBlocker: "Release and service owners must observe real workloads through the required freshness window.",
    requiredAssertions: ["evidence-freshness-verified", "evidence-drift-reconciled"], minObservationWindowHours: 168, minimumCoveragePct: 95, requireSecondaryDigest: true,
  },
  {
    version: "v3.5.1", key: "DEPENDENCY_UNBLOCK_IMPACT", label: "Dependency Unblock Impact",
    schemaVersion: "enterprise.operational-decision-dependency-impact.v1", sourceSignalId: "dependency-unblock-impact",
    sourceContracts: ["acyclic owner dependency graph", "upstream evidence fingerprint", "fenced downstream admission"],
    externalBlocker: "Service owners must verify real downstream impact after every dependency transition.",
    requiredAssertions: ["dependency-impact-verified", "downstream-admission-reconciled"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v3.5.2", key: "OWNER_SLA_ESCALATION", label: "Owner SLA and Escalation",
    schemaVersion: "enterprise.operational-decision-owner-sla.v1", sourceSignalId: "owner-sla-escalation",
    sourceContracts: ["priority-derived review SLA", "bounded escalation threshold", "organization-controlled owner identity"],
    externalBlocker: "Organization owners must bind the source policy to their incident and approval systems.",
    requiredAssertions: ["owner-sla-observed", "owner-escalation-rehearsed"], minObservationWindowHours: 720, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v3.5.3", key: "BOUNDED_WAIVER_EXPIRY", label: "Bounded Waiver and Expiry",
    schemaVersion: "enterprise.operational-decision-waiver-expiry.v1", sourceSignalId: "bounded-waiver-expiry",
    sourceContracts: ["non-renewable 24-hour maximum", "protected critical scopes", "automatic expiry and archive"],
    externalBlocker: "Security, privacy, release, and audit owners must rehearse expiry and prove no protected control can be bypassed.",
    requiredAssertions: ["waiver-expiry-rehearsed", "protected-controls-enforced"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v3.5.4", key: "INDEPENDENT_OPERATIONAL_DECISION_CLOSURE", label: "Independent Operational Decision Closure",
    schemaVersion: "enterprise.operational-decision-independent-closure.v1", sourceSignalId: "independent-operational-decision-closure",
    sourceContracts: ["ordered v3.5.0-v3.5.3 chain", "distinct decision authority", "immutable predecessor-bound archive"],
    externalBlocker: "A distinct operating authority must accept and retain the final decision package outside the Studio.",
    requiredAssertions: ["operational-decision-reviewed", "operational-decision-retained"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true, finalReview: true,
  },
];

export function buildOperationalDecisionGovernanceTrainState(input: {
  anchor: Parameters<typeof buildSourceBackedAssuranceProjection>[0]["anchor"];
  artifacts: ExternalAssuranceArtifact[];
  sourceSignals: OwnerWorkloadSourceSignalSnapshot;
  now: number;
}) {
  return buildSourceBackedAssuranceProjection({
    definitions: OPERATIONAL_DECISION_GOVERNANCE_DEFINITIONS,
    ...input,
  });
}

export function readOperationalDecisionGovernanceTrain() {
  const predecessor = readOwnerWorkloadAdmissionTrain();
  const anchor = predecessor.versions.find((version) => version.version === "v3.4.9");
  const artifacts = OPERATIONAL_DECISION_GOVERNANCE_DEFINITIONS.map((definition) =>
    readExternalAssuranceArtifact(`FIRST_LLM_OPERATIONAL_DECISION_${definition.key}`),
  );
  const sourceSignals = readOwnerWorkloadSourceSignals();
  return {
    ok: true as const,
    schemaVersion: OPERATIONAL_DECISION_GOVERNANCE_TRAIN_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...buildOperationalDecisionGovernanceTrainState({
      anchor: {
        version: "v3.4.9",
        evidenceStatus: anchor?.evidenceStatus || "missing",
        digest: anchor?.digest || null,
        recordId: anchor?.recordId || null,
        issuerOrganizationId: anchor?.issuerOrganizationId || null,
      },
      artifacts,
      sourceSignals,
      now: Date.now(),
    }),
    ownerWorkloadProtocol: sourceSignals.ownerWorkloadProtocol,
    remediationExecutionPlan: sourceSignals.remediationExecutionPlan,
    configuredVersions: OPERATIONAL_DECISION_GOVERNANCE_DEFINITIONS.filter((_, index) => artifacts[index]?.present).map((definition) => definition.version),
  };
}
