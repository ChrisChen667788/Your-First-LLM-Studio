import {
  readExternalAssuranceArtifact,
  type ExternalAssuranceArtifact,
} from "@/features/experiments/external-assurance-chain";
import { readOwnerReceiptIntakeTrain } from "@/features/experiments/owner-receipt-intake-train";
import {
  readOwnerReceiptLifecycleSourceSignals,
  type OwnerReceiptLifecycleSourceSignalId,
  type OwnerReceiptLifecycleSourceSignalSnapshot,
} from "@/features/experiments/owner-receipt-lifecycle-source-signals";
import {
  buildSourceBackedAssuranceProjection,
  type SourceBackedAssuranceDefinition,
} from "@/features/experiments/source-backed-assurance-projection";

export const OPERATIONAL_EXCEPTION_LIFECYCLE_TRAIN_SCHEMA_VERSION =
  "experiments.operational-exception-lifecycle-train.v1" as const;

export const OPERATIONAL_EXCEPTION_LIFECYCLE_DEFINITIONS: Array<
  SourceBackedAssuranceDefinition<OwnerReceiptLifecycleSourceSignalId>
> = [
  {
    version: "v3.7.0", key: "OWNER_SLA_BREACH_DETECTION", label: "Owner SLA Breach Detection",
    schemaVersion: "enterprise.operational-exception-sla-breach.v1", sourceSignalId: "owner-sla-breach-detection",
    sourceContracts: ["request-derived SLA clock", "overdue action read-model", "admission state preservation"],
    externalBlocker: "Organization owners must bind the source clock to their real incident and approval systems.",
    requiredAssertions: ["owner-sla-breach-detected", "incident-clock-reconciled"], minObservationWindowHours: 720, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v3.7.1", key: "ESCALATION_ACKNOWLEDGEMENT", label: "Escalation Acknowledgement Lifecycle",
    schemaVersion: "enterprise.operational-exception-escalation-ack.v1", sourceSignalId: "escalation-acknowledgement-lifecycle",
    sourceContracts: ["actor-bound acknowledgement", "append-only event", "underlying request preserved"],
    externalBlocker: "Incident, service, and audit owners must reconcile acknowledgement events with the external incident system.",
    requiredAssertions: ["escalation-acknowledged", "acknowledgement-retained"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v3.7.2", key: "BOUNDED_WAIVER_LIFECYCLE", label: "Bounded Waiver Lifecycle",
    schemaVersion: "enterprise.operational-exception-waiver-lifecycle.v1", sourceSignalId: "bounded-waiver-lifecycle",
    sourceContracts: ["scope-bound waiver", "24-hour automatic expiry", "protected controls excluded"],
    externalBlocker: "Security, privacy, release, and audit owners must rehearse expiry against the external control system.",
    requiredAssertions: ["waiver-expiry-rehearsed", "protected-controls-enforced"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v3.7.3", key: "OPERATIONAL_DECISION_PACKAGE", label: "Operational Decision Package",
    schemaVersion: "enterprise.operational-exception-decision-package.v1", sourceSignalId: "operational-decision-package",
    sourceContracts: ["protocol digest", "ledger digest", "terminal event and blocked decision"],
    externalBlocker: "Release and audit owners must verify and retain the exact decision package outside the Studio.",
    requiredAssertions: ["decision-package-verified", "decision-package-retained"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v3.7.4", key: "INDEPENDENT_EXCEPTION_GOVERNANCE_CLOSURE", label: "Independent Exception Governance Closure",
    schemaVersion: "enterprise.operational-exception-independent-closure.v1", sourceSignalId: "independent-exception-governance-closure",
    sourceContracts: ["ordered v3.7.0-v3.7.3 chain", "distinct operating authority", "immutable terminal archive"],
    externalBlocker: "A distinct operating authority must accept SLA, acknowledgement, waiver, and decision-package evidence.",
    requiredAssertions: ["exception-governance-reviewed", "exception-governance-retained"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true, finalReview: true,
  },
];

export function buildOperationalExceptionLifecycleTrainState(input: {
  anchor: Parameters<typeof buildSourceBackedAssuranceProjection>[0]["anchor"];
  artifacts: ExternalAssuranceArtifact[];
  sourceSignals: OwnerReceiptLifecycleSourceSignalSnapshot;
  now: number;
}) {
  return buildSourceBackedAssuranceProjection({ definitions: OPERATIONAL_EXCEPTION_LIFECYCLE_DEFINITIONS, ...input });
}

export function readOperationalExceptionLifecycleTrain() {
  const predecessor = readOwnerReceiptIntakeTrain();
  const anchor = predecessor.versions.find((version) => version.version === "v3.6.9");
  const artifacts = OPERATIONAL_EXCEPTION_LIFECYCLE_DEFINITIONS.map((definition) =>
    readExternalAssuranceArtifact(`FIRST_LLM_OPERATIONAL_EXCEPTION_${definition.key}`),
  );
  const sourceSignals = readOwnerReceiptLifecycleSourceSignals();
  return {
    ok: true as const,
    schemaVersion: OPERATIONAL_EXCEPTION_LIFECYCLE_TRAIN_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...buildOperationalExceptionLifecycleTrainState({
      anchor: {
        version: "v3.6.9",
        evidenceStatus: anchor?.evidenceStatus || "missing",
        digest: anchor?.digest || null,
        recordId: anchor?.recordId || null,
        issuerOrganizationId: anchor?.issuerOrganizationId || null,
      },
      artifacts,
      sourceSignals,
      now: Date.now(),
    }),
    ownerReceiptLifecycle: sourceSignals.lifecycle,
    ownerWorkloadProtocol: sourceSignals.protocol,
    configuredVersions: OPERATIONAL_EXCEPTION_LIFECYCLE_DEFINITIONS.filter((_, index) => artifacts[index]?.present).map((definition) => definition.version),
  };
}

