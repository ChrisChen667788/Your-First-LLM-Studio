import {
  readExternalAssuranceArtifact,
  type ExternalAssuranceArtifact,
} from "@/features/experiments/external-assurance-chain";
import { readOperationalAcceptanceTrain } from "@/features/experiments/operational-acceptance-train";
import {
  readOwnerWorkloadSourceSignals,
  type OwnerWorkloadSourceSignalId,
  type OwnerWorkloadSourceSignalSnapshot,
} from "@/features/experiments/owner-workload-source-signals";
import {
  buildSourceBackedAssuranceProjection,
  type SourceBackedAssuranceDefinition,
} from "@/features/experiments/source-backed-assurance-projection";

export const OWNER_WORKLOAD_ADMISSION_TRAIN_SCHEMA_VERSION =
  "experiments.owner-workload-admission-train.v1" as const;

export const OWNER_WORKLOAD_ADMISSION_DEFINITIONS: Array<
  SourceBackedAssuranceDefinition<OwnerWorkloadSourceSignalId>
> = [
  {
    version: "v3.4.0", key: "PROVIDER_WORKLOAD_ADMISSION", label: "Provider Workload Admission",
    schemaVersion: "enterprise.owner-workload-provider-admission.v1", sourceSignalId: "provider-workload-admission",
    sourceContracts: ["digest-bound provider request", "authorized credential boundary", "rollback-preserving provider receipt"],
    externalBlocker: "Provider, gateway, and billing owners must execute and sign the representative workload.",
    requiredAssertions: ["provider-workload-admitted", "provider-workload-receipt-retained"], minObservationWindowHours: 168, minimumCoveragePct: 95, requireSecondaryDigest: true,
  },
  {
    version: "v3.4.1", key: "RETRIEVAL_WORKLOAD_ADMISSION", label: "Retrieval Workload Admission",
    schemaVersion: "enterprise.owner-workload-retrieval-admission.v1", sourceSignalId: "retrieval-workload-admission",
    sourceContracts: ["managed corpus request", "ACL and deletion probes", "index rollback receipt"],
    externalBlocker: "Knowledge, identity, and database owners must execute the managed retrieval workload.",
    requiredAssertions: ["retrieval-workload-admitted", "retrieval-workload-receipt-retained"], minObservationWindowHours: 168, minimumCoveragePct: 95, requireSecondaryDigest: true,
  },
  {
    version: "v3.4.2", key: "MODEL_SUPPLY_CHAIN_WORKLOAD_ADMISSION", label: "Model Supply-chain Workload Admission",
    schemaVersion: "enterprise.owner-workload-model-admission.v1", sourceSignalId: "model-supply-chain-workload-admission",
    sourceContracts: ["authenticated multi-file transfer request", "destination checksum read-back", "registry rollback receipt"],
    externalBlocker: "Hub, storage, license, and runtime owners must perform and sign the immutable transfer.",
    requiredAssertions: ["model-workload-admitted", "model-transfer-receipt-retained"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v3.4.3", key: "WORKSPACE_AUDIT_WORKLOAD_ADMISSION", label: "Workspace Audit Workload Admission",
    schemaVersion: "enterprise.owner-workload-workspace-admission.v1", sourceSignalId: "workspace-audit-workload-admission",
    sourceContracts: ["trusted operator request", "database RLS and audit binding", "compensation receipt"],
    externalBlocker: "Identity, SCIM, database, audit, and privacy owners must execute real multi-user actions.",
    requiredAssertions: ["workspace-workload-admitted", "workspace-audit-receipt-retained"], minObservationWindowHours: 168, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v3.4.4", key: "RUNTIME_CAPACITY_WORKLOAD_ADMISSION", label: "Runtime Capacity Workload Admission",
    schemaVersion: "enterprise.owner-workload-runtime-admission.v1", sourceSignalId: "runtime-capacity-workload-admission",
    sourceContracts: ["same-profile recovery request", "bounded runtime operations", "last-known-good rollback receipt"],
    externalBlocker: "Independent runtime owners must repeat the workload on representative hardware and models.",
    requiredAssertions: ["runtime-workload-admitted", "runtime-recovery-receipt-retained"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v3.4.5", key: "BENCHMARK_CANDIDATE_WORKLOAD_ADMISSION", label: "Benchmark Candidate Workload Admission",
    schemaVersion: "enterprise.owner-workload-benchmark-admission.v1", sourceSignalId: "benchmark-candidate-workload-admission",
    sourceContracts: ["paired candidate request", "evaluator and budget binding", "baseline-preserving receipt"],
    externalBlocker: "Independent quality and finance owners must approve and execute the candidate benchmark.",
    requiredAssertions: ["benchmark-workload-admitted", "benchmark-decision-receipt-retained"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v3.4.6", key: "TELEMETRY_EXPORT_WORKLOAD_ADMISSION", label: "Telemetry Export Workload Admission",
    schemaVersion: "enterprise.owner-workload-telemetry-admission.v1", sourceSignalId: "telemetry-export-workload-admission",
    sourceContracts: ["real exporter request", "usage and cost reconciliation", "secret-safe rollback receipt"],
    externalBlocker: "Observability, infrastructure, privacy, and finance owners must verify deployed traces and retention.",
    requiredAssertions: ["telemetry-workload-admitted", "telemetry-export-receipt-retained"], minObservationWindowHours: 168, minimumCoveragePct: 95, requireSecondaryDigest: true,
  },
  {
    version: "v3.4.7", key: "OWNER_WORKLOAD_REQUEST_PROTOCOL", label: "Owner Workload Request Protocol",
    schemaVersion: "enterprise.owner-workload-request-protocol.v1", sourceSignalId: "owner-workload-request-protocol",
    sourceContracts: ["strict request schema", "idempotency and fencing binding", "bounded review and escalation"],
    externalBlocker: "Production operators must verify request admission against the organization queue and lease store.",
    requiredAssertions: ["owner-request-protocol-verified", "owner-request-fencing-verified"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v3.4.8", key: "OWNER_WORKLOAD_RECEIPT_PROTOCOL", label: "Owner Workload Receipt Protocol",
    schemaVersion: "enterprise.owner-workload-receipt-protocol.v1", sourceSignalId: "owner-workload-receipt-protocol",
    sourceContracts: ["strict candidate receipt schema", "request and identity binding", "detached signature and immutable archive"],
    externalBlocker: "Security and archive owners must verify signatures, pinned trust anchors, read-back, and retention.",
    requiredAssertions: ["owner-receipt-protocol-verified", "owner-receipt-archive-verified"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v3.4.9", key: "INDEPENDENT_WORKLOAD_RECEIPT_CLOSURE", label: "Independent Workload Receipt Closure",
    schemaVersion: "enterprise.owner-workload-independent-closure.v1", sourceSignalId: "independent-workload-receipt-closure",
    sourceContracts: ["ordered v3.4.0-v3.4.8 chain", "distinct execution and review identities", "immutable terminal receipt"],
    externalBlocker: "A distinct assurance authority must accept and retain the workload package outside the Studio.",
    requiredAssertions: ["owner-workload-package-accepted", "owner-workload-package-retained"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true, finalReview: true,
  },
];

export function buildOwnerWorkloadAdmissionTrainState(input: {
  anchor: Parameters<typeof buildSourceBackedAssuranceProjection>[0]["anchor"];
  artifacts: ExternalAssuranceArtifact[];
  sourceSignals: OwnerWorkloadSourceSignalSnapshot;
  now: number;
}) {
  return buildSourceBackedAssuranceProjection({
    definitions: OWNER_WORKLOAD_ADMISSION_DEFINITIONS,
    ...input,
  });
}

export function readOwnerWorkloadAdmissionTrain() {
  const predecessor = readOperationalAcceptanceTrain();
  const anchor = predecessor.versions.find((version) => version.version === "v3.3.4");
  const artifacts = OWNER_WORKLOAD_ADMISSION_DEFINITIONS.map((definition) =>
    readExternalAssuranceArtifact(`FIRST_LLM_OWNER_WORKLOAD_${definition.key}`),
  );
  const sourceSignals = readOwnerWorkloadSourceSignals();
  return {
    ok: true as const,
    schemaVersion: OWNER_WORKLOAD_ADMISSION_TRAIN_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...buildOwnerWorkloadAdmissionTrainState({
      anchor: {
        version: "v3.3.4",
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
    configuredVersions: OWNER_WORKLOAD_ADMISSION_DEFINITIONS.filter((_, index) => artifacts[index]?.present).map((definition) => definition.version),
  };
}
