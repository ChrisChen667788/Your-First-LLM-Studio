import {
  readExternalAssuranceArtifact,
  type ExternalAssuranceArtifact,
} from "@/features/experiments/external-assurance-chain";
import {
  readServiceReadinessSourceSignals,
  type ServiceReadinessSourceSignalId,
  type ServiceReadinessSourceSignalSnapshot,
} from "@/features/experiments/service-readiness-source-signals";
import {
  buildSourceBackedAssuranceProjection,
  type SourceBackedAssuranceDefinition,
} from "@/features/experiments/source-backed-assurance-projection";
import { readSustainableOperationsUpgradeTrain } from "@/features/experiments/sustainable-operations-upgrade-train";

export const REMEDIATION_CONTROL_TRAIN_SCHEMA_VERSION =
  "experiments.remediation-control-train.v1" as const;

export const REMEDIATION_CONTROL_DEFINITIONS: Array<
  SourceBackedAssuranceDefinition<ServiceReadinessSourceSignalId>
> = [
  {
    version: "v3.0.0",
    key: "PROVIDER_REMEDIATION_CONTROL",
    label: "Provider Remediation Control",
    schemaVersion: "enterprise.remediation-control-provider.v1",
    sourceSignalId: "provider-remediation-control",
    sourceContracts: ["observed traffic and release probe", "fallback, quota, cost, and snapshot reconciliation", "owned actions and evidence fingerprint"],
    externalBlocker: "Gateway, provider, and billing owners must execute and reconcile representative deployed traffic.",
    requiredAssertions: ["provider-remediation-executed", "provider-reconciliation-reviewed"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 95,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.0.1",
    key: "RETRIEVAL_REMEDIATION_CONTROL",
    label: "Retrieval Remediation Control",
    schemaVersion: "enterprise.remediation-control-retrieval.v1",
    sourceSignalId: "retrieval-remediation-control",
    sourceContracts: ["managed dependency preflight", "freshness, citation, deletion, and ACL evaluation", "dependency-bound remediation actions"],
    externalBlocker: "Knowledge, identity, and database owners must repeat the managed corpus and leakage workload.",
    requiredAssertions: ["retrieval-remediation-executed", "retrieval-leakage-reviewed"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 95,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.0.2",
    key: "MODEL_SUPPLY_CHAIN_REMEDIATION_CONTROL",
    label: "Model Supply-chain Remediation Control",
    schemaVersion: "enterprise.remediation-control-model-supply-chain.v1",
    sourceSignalId: "model-supply-chain-remediation-control",
    sourceContracts: ["authenticated immutable Hub revision", "multi-file destination checksums", "activation, removal, and rollback read-back"],
    externalBlocker: "Hub, storage, runtime, license, and security owners must repeat transfer and read-back on managed systems.",
    requiredAssertions: ["model-transfer-authenticated", "model-destination-reconciled"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.0.3",
    key: "WORKSPACE_AUDIT_REMEDIATION_CONTROL",
    label: "Workspace Audit Remediation Control",
    schemaVersion: "enterprise.remediation-control-workspace-audit.v1",
    sourceSignalId: "workspace-audit-remediation-control",
    sourceContracts: ["database-enforced workspace ACL", "signed request and action provenance", "privacy-safe audit reconciliation"],
    externalBlocker: "Organization identity, database, audit, and privacy owners must reconcile real multi-user actions.",
    requiredAssertions: ["workspace-action-provenance-signed", "workspace-audit-reconciled"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.0.4",
    key: "RUNTIME_CAPACITY_REMEDIATION_CONTROL",
    label: "Runtime Capacity Remediation Control",
    schemaVersion: "enterprise.remediation-control-runtime-capacity.v1",
    sourceSignalId: "runtime-capacity-remediation-control",
    sourceContracts: ["same-profile comparable performance receipts", "six-operation lifecycle recovery", "representative hardware and model identity"],
    externalBlocker: "Independent runtime operators must repeat capacity and recovery workloads on representative hardware.",
    requiredAssertions: ["runtime-capacity-compared", "runtime-recovery-complete"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.0.5",
    key: "BENCHMARK_CANDIDATE_REMEDIATION_CONTROL",
    label: "Benchmark Candidate Remediation Control",
    schemaVersion: "enterprise.remediation-control-benchmark-candidate.v1",
    sourceSignalId: "benchmark-candidate-remediation-control",
    sourceContracts: ["distinct complete qualified candidate", "paired confidence and non-inferiority", "latency, token, error, and review policy"],
    externalBlocker: "Independent quality owners must approve blind sets, evaluator identity, cost budgets, and promotion thresholds.",
    requiredAssertions: ["benchmark-candidate-complete", "benchmark-paired-decision-reviewed"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.0.6",
    key: "TELEMETRY_EXPORT_REMEDIATION_CONTROL",
    label: "Telemetry Export Remediation Control",
    schemaVersion: "enterprise.remediation-control-telemetry-export.v1",
    sourceSignalId: "telemetry-export-remediation-control",
    sourceContracts: ["configured OTLP or Langfuse exporter", "end-to-end trace and usage reconciliation", "secret-safe resource and cost attribution"],
    externalBlocker: "Observability, infrastructure, and finance owners must validate deployed traces, retention, sampling, and billing identity.",
    requiredAssertions: ["telemetry-export-observed", "telemetry-usage-reconciled"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 95,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.0.7",
    key: "REMEDIATION_DEPENDENCY_GRAPH",
    label: "Remediation Dependency Graph",
    schemaVersion: "enterprise.remediation-control-dependency-graph.v1",
    sourceSignalId: "remediation-dependency-graph",
    sourceContracts: ["one policy per owner signal", "acyclic deterministic dependency order", "blocked-by and priority projection"],
    externalBlocker: "Program owners must approve sequencing, accountable owners, service windows, and escalation paths.",
    requiredAssertions: ["remediation-dependencies-approved", "remediation-owners-accountable"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.0.8",
    key: "REMEDIATION_EVIDENCE_PACKAGE",
    label: "Remediation Evidence Package",
    schemaVersion: "enterprise.remediation-control-evidence-package.v1",
    sourceSignalId: "remediation-evidence-package",
    sourceContracts: ["acceptance and next-action manifest", "per-control evidence fingerprint", "deterministic package digest and read-back"],
    externalBlocker: "A separately operated archive must verify package bytes, retention, and destination read-back.",
    requiredAssertions: ["remediation-package-readback", "remediation-package-retained"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.0.9",
    key: "INDEPENDENT_REMEDIATION_ACCEPTANCE",
    label: "Independent Remediation Acceptance",
    schemaVersion: "enterprise.remediation-control-independent-acceptance.v1",
    sourceSignalId: "independent-remediation-acceptance",
    sourceContracts: ["ordered v3.0.0-v3.0.8 evidence", "distinct operations, quality, security, and privacy review", "immutable terminal archive"],
    externalBlocker: "A distinct assurance authority must accept and retain the complete remediation package outside the Studio.",
    requiredAssertions: ["remediation-control-accepted", "remediation-control-retained"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
    finalReview: true,
  },
];

export function buildRemediationControlTrainState(input: {
  anchor: Parameters<typeof buildSourceBackedAssuranceProjection>[0]["anchor"];
  artifacts: ExternalAssuranceArtifact[];
  sourceSignals: ServiceReadinessSourceSignalSnapshot;
  now: number;
}) {
  return buildSourceBackedAssuranceProjection({
    definitions: REMEDIATION_CONTROL_DEFINITIONS,
    ...input,
  });
}

export function readRemediationControlTrain() {
  const predecessor = readSustainableOperationsUpgradeTrain();
  const anchor = predecessor.versions.find((version) => version.version === "v2.9.4");
  const artifacts = REMEDIATION_CONTROL_DEFINITIONS.map((definition) =>
    readExternalAssuranceArtifact(`FIRST_LLM_REMEDIATION_CONTROL_${definition.key}`),
  );
  const sourceSignals = readServiceReadinessSourceSignals();
  return {
    ok: true as const,
    schemaVersion: REMEDIATION_CONTROL_TRAIN_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...buildRemediationControlTrainState({
      anchor: {
        version: "v2.9.4",
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
    configuredVersions: REMEDIATION_CONTROL_DEFINITIONS.filter(
      (_, index) => artifacts[index]?.present,
    ).map((definition) => definition.version),
  };
}
