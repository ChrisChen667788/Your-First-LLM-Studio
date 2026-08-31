import {
  readExternalAssuranceArtifact,
  type ExternalAssuranceArtifact,
} from "@/features/experiments/external-assurance-chain";
import { readOperationalDecisionGovernanceTrain } from "@/features/experiments/operational-decision-governance-train";
import {
  readOwnerReceiptLifecycleSourceSignals,
  type OwnerReceiptLifecycleSourceSignalId,
  type OwnerReceiptLifecycleSourceSignalSnapshot,
} from "@/features/experiments/owner-receipt-lifecycle-source-signals";
import {
  buildSourceBackedAssuranceProjection,
  type SourceBackedAssuranceDefinition,
} from "@/features/experiments/source-backed-assurance-projection";

export const OWNER_RECEIPT_INTAKE_TRAIN_SCHEMA_VERSION =
  "experiments.owner-receipt-intake-train.v1" as const;

export const OWNER_RECEIPT_INTAKE_DEFINITIONS: Array<
  SourceBackedAssuranceDefinition<OwnerReceiptLifecycleSourceSignalId>
> = [
  {
    version: "v3.6.0", key: "PROVIDER_RECEIPT_INTAKE", label: "Provider Receipt Intake",
    schemaVersion: "enterprise.owner-receipt-provider-intake.v1", sourceSignalId: "provider-receipt-intake",
    sourceContracts: ["strict provider receipt", "digest-only local retention", "external signature pending"],
    externalBlocker: "Provider, gateway, billing, and archive owners must sign and retain representative traffic evidence.",
    requiredAssertions: ["provider-receipt-verified", "provider-receipt-archived"], minObservationWindowHours: 168, minimumCoveragePct: 95, requireSecondaryDigest: true,
  },
  {
    version: "v3.6.1", key: "RETRIEVAL_RECEIPT_INTAKE", label: "Retrieval Receipt Intake",
    schemaVersion: "enterprise.owner-receipt-retrieval-intake.v1", sourceSignalId: "retrieval-receipt-intake",
    sourceContracts: ["managed retrieval receipt", "ACL and deletion evidence", "index rollback digest"],
    externalBlocker: "Knowledge, identity, database, and privacy owners must sign the managed retrieval receipt.",
    requiredAssertions: ["retrieval-receipt-verified", "retrieval-rollback-retained"], minObservationWindowHours: 168, minimumCoveragePct: 95, requireSecondaryDigest: true,
  },
  {
    version: "v3.6.2", key: "MODEL_RECEIPT_INTAKE", label: "Model Supply-chain Receipt Intake",
    schemaVersion: "enterprise.owner-receipt-model-intake.v1", sourceSignalId: "model-supply-chain-receipt-intake",
    sourceContracts: ["immutable model identity", "destination checksum", "license and activation receipt"],
    externalBlocker: "Hub, storage, license, and runtime owners must sign the immutable transfer receipt.",
    requiredAssertions: ["model-receipt-verified", "model-provenance-retained"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v3.6.3", key: "WORKSPACE_RECEIPT_INTAKE", label: "Workspace Receipt Intake",
    schemaVersion: "enterprise.owner-receipt-workspace-intake.v1", sourceSignalId: "workspace-receipt-intake",
    sourceContracts: ["trusted operator identity", "RLS decision receipt", "compensating audit event"],
    externalBlocker: "Identity, SCIM, database, audit, and privacy owners must sign the multi-user workspace receipt.",
    requiredAssertions: ["workspace-receipt-verified", "workspace-compensation-retained"], minObservationWindowHours: 168, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v3.6.4", key: "RUNTIME_RECEIPT_INTAKE", label: "Runtime Receipt Intake",
    schemaVersion: "enterprise.owner-receipt-runtime-intake.v1", sourceSignalId: "runtime-receipt-intake",
    sourceContracts: ["representative hardware identity", "capacity and recovery evidence", "last-known-good rollback"],
    externalBlocker: "Independent runtime operators must repeat and sign capacity, recovery, and rollback evidence.",
    requiredAssertions: ["runtime-receipt-verified", "runtime-recovery-retained"], minObservationWindowHours: 168, minimumCoveragePct: 95, requireSecondaryDigest: true,
  },
  {
    version: "v3.6.5", key: "BENCHMARK_RECEIPT_INTAKE", label: "Benchmark Receipt Intake",
    schemaVersion: "enterprise.owner-receipt-benchmark-intake.v1", sourceSignalId: "benchmark-receipt-intake",
    sourceContracts: ["distinct candidate receipt", "blind evaluation identity", "quality cost and latency decision"],
    externalBlocker: "Independent quality and finance owners must sign the candidate decision receipt.",
    requiredAssertions: ["benchmark-receipt-verified", "benchmark-decision-retained"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v3.6.6", key: "TELEMETRY_RECEIPT_INTAKE", label: "Telemetry Receipt Intake",
    schemaVersion: "enterprise.owner-receipt-telemetry-intake.v1", sourceSignalId: "telemetry-receipt-intake",
    sourceContracts: ["real exporter receipt", "usage and cost reconciliation", "retention and rollback evidence"],
    externalBlocker: "Observability, infrastructure, privacy, and finance owners must sign exporter evidence.",
    requiredAssertions: ["telemetry-receipt-verified", "telemetry-reconciliation-retained"], minObservationWindowHours: 168, minimumCoveragePct: 95, requireSecondaryDigest: true,
  },
  {
    version: "v3.6.7", key: "RECEIPT_QUARANTINE_LEDGER", label: "Candidate Receipt Quarantine Ledger",
    schemaVersion: "enterprise.owner-receipt-quarantine-ledger.v1", sourceSignalId: "candidate-receipt-quarantine-ledger",
    sourceContracts: ["append-only digest events", "optimistic concurrency", "invalid candidate quarantine"],
    externalBlocker: "Security and archive owners must verify the detached signature and immutable object read-back.",
    requiredAssertions: ["receipt-ledger-chain-verified", "quarantine-readback-verified"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v3.6.8", key: "COMPENSATION_RECONCILIATION", label: "Compensation and Rollback Reconciliation",
    schemaVersion: "enterprise.owner-receipt-compensation-reconciliation.v1", sourceSignalId: "compensation-rollback-reconciliation",
    sourceContracts: ["receipt-bound compensation", "strict rollback evidence digest", "original event preservation"],
    externalBlocker: "Service and audit owners must execute and retain real rollback or compensation evidence.",
    requiredAssertions: ["compensation-evidence-verified", "rollback-readback-retained"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v3.6.9", key: "INDEPENDENT_RECEIPT_LEDGER_CLOSURE", label: "Independent Receipt Ledger Closure",
    schemaVersion: "enterprise.owner-receipt-independent-ledger-closure.v1", sourceSignalId: "independent-receipt-ledger-closure",
    sourceContracts: ["ordered v3.6.0-v3.6.8 chain", "distinct receipt authority", "immutable terminal archive"],
    externalBlocker: "A distinct authority must accept the complete receipt ledger and terminal digest outside the Studio.",
    requiredAssertions: ["receipt-ledger-reviewed", "receipt-ledger-retained"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true, finalReview: true,
  },
];

export function buildOwnerReceiptIntakeTrainState(input: {
  anchor: Parameters<typeof buildSourceBackedAssuranceProjection>[0]["anchor"];
  artifacts: ExternalAssuranceArtifact[];
  sourceSignals: OwnerReceiptLifecycleSourceSignalSnapshot;
  now: number;
}) {
  return buildSourceBackedAssuranceProjection({ definitions: OWNER_RECEIPT_INTAKE_DEFINITIONS, ...input });
}

export function readOwnerReceiptIntakeTrain() {
  const predecessor = readOperationalDecisionGovernanceTrain();
  const anchor = predecessor.versions.find((version) => version.version === "v3.5.4");
  const artifacts = OWNER_RECEIPT_INTAKE_DEFINITIONS.map((definition) =>
    readExternalAssuranceArtifact(`FIRST_LLM_OWNER_RECEIPT_INTAKE_${definition.key}`),
  );
  const sourceSignals = readOwnerReceiptLifecycleSourceSignals();
  return {
    ok: true as const,
    schemaVersion: OWNER_RECEIPT_INTAKE_TRAIN_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...buildOwnerReceiptIntakeTrainState({
      anchor: {
        version: "v3.5.4",
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
    configuredVersions: OWNER_RECEIPT_INTAKE_DEFINITIONS.filter((_, index) => artifacts[index]?.present).map((definition) => definition.version),
  };
}

