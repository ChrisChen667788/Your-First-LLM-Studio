import { createHash } from "node:crypto";

import { readAgentActionTrustRecoveryEvidence } from "@/features/agent/action-trust-recovery-evidence";
import { readBenchmarkQualification } from "@/features/benchmark/qualification-service";
import { readDeploymentControlPlane } from "@/features/deployment/control-plane";
import { readFineTuneQualityExportEvidence } from "@/features/finetune/quality-export-acceptance";
import { readProviderOpsEvidenceSummary } from "@/features/providers/provider-ops-evidence";
import { readRagGovernanceEvidence } from "@/features/retrieval/rag-governance-evidence";
import { readEnterpriseRetrievalReadModel } from "@/features/retrieval/enterprise-service";
import { readRuntimeAdapterConformance } from "@/features/runtime/adapter-conformance";
import { readTelemetryEvidence } from "@/features/telemetry/trace-adapter";
import { readWorkflowExecutionClosureEvidence } from "@/features/workflows/execution-closure-acceptance";

export const OPERATIONAL_SOURCE_SIGNALS_SCHEMA_VERSION =
  "experiments.operational-source-signals.v1" as const;

export type OperationalSourceSignalId =
  | "runtime-fleet"
  | "provider-reliability"
  | "workload-slo"
  | "token-cost"
  | "benchmark-drift"
  | "retrieval-drift"
  | "agent-action-safety"
  | "workflow-recovery"
  | "finetune-roi"
  | "independent-ops-review"
  | "deployment-portability"
  | "data-sovereignty"
  | "customer-keys"
  | "continuity-exit"
  | "independent-lifecycle-review";

export type OperationalSourceSignalStatus =
  | "pass"
  | "attention"
  | "unavailable"
  | "external-only";

export type OperationalSourceSignal = {
  id: OperationalSourceSignalId;
  label: string;
  status: OperationalSourceSignalStatus;
  summary: string;
  checks: Record<string, boolean>;
  metrics: Record<string, string | number | boolean | null>;
  blockers: string[];
  evidenceUri: string;
};

export type OperationalSourceSignalSnapshot = {
  ok: true;
  schemaVersion: typeof OPERATIONAL_SOURCE_SIGNALS_SCHEMA_VERSION;
  generatedAt: string;
  localStatus: "pass" | "attention";
  summary: {
    totalSignals: number;
    sourceOwnedSignals: number;
    passingSignals: number;
    attentionSignals: number;
    unavailableSignals: number;
    externalOnlySignals: number;
  };
  signals: OperationalSourceSignal[];
  stateDigest: string;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function signal(input: Omit<OperationalSourceSignal, "status">): OperationalSourceSignal {
  return {
    ...input,
    status: Object.values(input.checks).every(Boolean) ? "pass" : "attention",
  };
}

function unavailableSignal(input: {
  id: OperationalSourceSignalId;
  label: string;
  evidenceUri: string;
  error: unknown;
}): OperationalSourceSignal {
  const message = input.error instanceof Error ? input.error.message : "Signal read failed.";
  return {
    id: input.id,
    label: input.label,
    status: "unavailable",
    summary: "The source-owned signal could not be read without side effects.",
    checks: { readSucceeded: false },
    metrics: {},
    blockers: [message],
    evidenceUri: input.evidenceUri,
  };
}

function externalOnlySignal(
  id: OperationalSourceSignalId,
  label: string,
): OperationalSourceSignal {
  return {
    id,
    label,
    status: "external-only",
    summary: "This milestone is intentionally satisfied only by an independently signed external review.",
    checks: { localSubstitutionDenied: true },
    metrics: {},
    blockers: ["No local fixture, operator action, or repository receipt can replace the independent review."],
    evidenceUri: "/experiments",
  };
}

function trySignal(
  identity: Pick<OperationalSourceSignal, "id" | "label" | "evidenceUri">,
  reader: () => OperationalSourceSignal,
) {
  try {
    return reader();
  } catch (error) {
    return unavailableSignal({ ...identity, error });
  }
}

export function buildOperationalSourceSignalSnapshot(
  signals: OperationalSourceSignal[],
): OperationalSourceSignalSnapshot {
  const sourceOwned = signals.filter((entry) => entry.status !== "external-only");
  const withoutDigest = {
    ok: true as const,
    schemaVersion: OPERATIONAL_SOURCE_SIGNALS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localStatus: sourceOwned.every((entry) => entry.status === "pass")
      ? ("pass" as const)
      : ("attention" as const),
    summary: {
      totalSignals: signals.length,
      sourceOwnedSignals: sourceOwned.length,
      passingSignals: signals.filter((entry) => entry.status === "pass").length,
      attentionSignals: signals.filter((entry) => entry.status === "attention").length,
      unavailableSignals: signals.filter((entry) => entry.status === "unavailable").length,
      externalOnlySignals: signals.filter((entry) => entry.status === "external-only").length,
    },
    signals,
  };
  return {
    ...withoutDigest,
    stateDigest: createHash("sha256").update(stableJson(withoutDigest)).digest("hex"),
  };
}

export function readOperationalSourceSignals() {
  const provider = trySignal(
    { id: "provider-reliability", label: "Provider reliability", evidenceUri: "/admin" },
    () => {
      const summary = readProviderOpsEvidenceSummary({ windowHours: 168 });
      const checks = {
        providerInventoryAvailable: summary.totals.providerCount > 0,
        realTrafficObserved:
          summary.totals.totalRequests > 0 || summary.releaseProbe.totalCount > 0,
        successfulRequestObserved:
          summary.totals.successCount > 0 || summary.releaseProbe.successCount > 0,
      };
      return signal({
        id: "provider-reliability",
        label: "Provider reliability",
        summary: `${summary.totals.providerCount} providers, ${summary.totals.totalRequests} requests, ${summary.totals.successRatePct}% success in 168h.`,
        checks,
        metrics: {
          providers: summary.totals.providerCount,
          requests: summary.totals.totalRequests,
          successRatePct: summary.totals.successRatePct,
          releaseProbeSuccesses: summary.releaseProbe.successCount,
          totalTokens: summary.totals.totalTokens,
          estimatedCostUsd: summary.totals.estimatedCostUsd,
        },
        blockers: [
          ...(checks.providerInventoryAvailable ? [] : ["No remote provider target is registered."]),
          ...(checks.realTrafficObserved ? [] : ["No real provider request or release probe is available in the observation window."]),
          ...(checks.successfulRequestObserved ? [] : ["No successful provider request is available in the observation window."]),
        ],
        evidenceUri: "/admin",
      });
    },
  );

  const signals: OperationalSourceSignal[] = [
    trySignal(
      { id: "runtime-fleet", label: "Runtime fleet", evidenceUri: "/models/runtime" },
      () => {
        const runtime = readRuntimeAdapterConformance();
        const checks = {
          adapterInventoryAvailable: runtime.totals.adapters > 0,
          normalizedOperationContract: runtime.totals.conformant > 0,
          noPreviewOnlyAdapter: runtime.totals.preview === 0,
        };
        return signal({
          id: "runtime-fleet",
          label: "Runtime fleet",
          summary: `${runtime.totals.conformant}/${runtime.totals.adapters} runtime adapters conform to the backend-neutral operation contract.`,
          checks,
          metrics: {
            adapters: runtime.totals.adapters,
            conformant: runtime.totals.conformant,
            hostPlatform: runtime.host.platform,
            hostArch: runtime.host.arch,
          },
          blockers: [
            ...(checks.adapterInventoryAvailable ? [] : ["No runtime adapter is registered."]),
            ...(checks.normalizedOperationContract ? [] : ["No runtime adapter passes normalized operation conformance."]),
            ...(checks.noPreviewOnlyAdapter ? [] : ["At least one runtime adapter is still preview-only."]),
          ],
          evidenceUri: "/models/runtime",
        });
      },
    ),
    provider,
    trySignal(
      { id: "workload-slo", label: "Workload SLO", evidenceUri: "/api/telemetry" },
      () => {
        const telemetry = readTelemetryEvidence();
        const providerMetrics = provider.metrics;
        const requestCount = Number(providerMetrics.requests || 0);
        const successRatePct = Number(providerMetrics.successRatePct || 0);
        const checks = {
          workloadObserved: telemetry.totals.spans > 0 || requestCount > 0,
          errorBudgetMeasurable: requestCount > 0,
          providerSuccessRateHealthy: requestCount > 0 && successRatePct >= 95,
        };
        return signal({
          id: "workload-slo",
          label: "Workload SLO",
          summary: `${telemetry.totals.spans} spans and ${requestCount} provider requests are available for latency/error-budget analysis.`,
          checks,
          metrics: {
            spans: telemetry.totals.spans,
            spanErrors: telemetry.totals.errors,
            providerRequests: requestCount,
            providerSuccessRatePct: successRatePct,
          },
          blockers: [
            ...(checks.workloadObserved ? [] : ["No workload observation is available."]),
            ...(checks.errorBudgetMeasurable ? [] : ["A request denominator is required for error-budget measurement."]),
            ...(checks.providerSuccessRateHealthy ? [] : ["The observed provider success rate is below the 95% local threshold or has no traffic."]),
          ],
          evidenceUri: "/api/telemetry",
        });
      },
    ),
    trySignal(
      { id: "token-cost", label: "Token and cost reconciliation", evidenceUri: "/admin" },
      () => {
        const deployment = readDeploymentControlPlane();
        const totalTokens = Number(provider.metrics.totalTokens || 0);
        const estimatedCostUsd = provider.metrics.estimatedCostUsd;
        const checks = {
          tokenUsageObserved: totalTokens > 0,
          providerCostObserved: typeof estimatedCostUsd === "number",
          durableUsageOutboxAvailable: deployment.controlPlane.usageOutbox.records > 0,
          outboxDrainHealthy: deployment.controlPlane.usageOutbox.failed === 0,
        };
        return signal({
          id: "token-cost",
          label: "Token and cost reconciliation",
          summary: `${totalTokens} provider tokens and ${deployment.controlPlane.usageOutbox.records} durable usage records are available.`,
          checks,
          metrics: {
            totalTokens,
            estimatedCostUsd: typeof estimatedCostUsd === "number" ? estimatedCostUsd : null,
            usageRecords: deployment.controlPlane.usageOutbox.records,
            pendingUsageRecords: deployment.controlPlane.usageOutbox.pending,
            failedUsageRecords: deployment.controlPlane.usageOutbox.failed,
          },
          blockers: [
            ...(checks.tokenUsageObserved ? [] : ["No provider token usage is recorded."]),
            ...(checks.providerCostObserved ? [] : ["No provider cost estimate is available."]),
            ...(checks.durableUsageOutboxAvailable ? [] : ["No durable usage outbox record is available."]),
            ...(checks.outboxDrainHealthy ? [] : ["The durable usage outbox contains failed records."]),
          ],
          evidenceUri: "/admin",
        });
      },
    ),
    trySignal(
      { id: "benchmark-drift", label: "Benchmark drift", evidenceUri: "/benchmarks" },
      () => {
        const benchmark = readBenchmarkQualification();
        const checks = {
          officialDatasetQualified: benchmark.localStatus === "pass",
          immutableSnapshotVerified: benchmark.snapshotIntegrity === "verified",
          qualifiedDatasetAvailable: Boolean(benchmark.qualifiedDataset),
        };
        return signal({
          id: "benchmark-drift",
          label: "Benchmark drift",
          summary: benchmark.qualifiedDataset
            ? `${benchmark.qualifiedDataset.sampleCount} qualified MATH-500 rows are pinned for repeatable drift checks.`
            : "No verified official benchmark snapshot is currently available.",
          checks,
          metrics: {
            checksPassed: benchmark.totals.passed,
            checksHeld: benchmark.totals.held,
            snapshotIntegrity: benchmark.snapshotIntegrity,
            qualifiedRows: benchmark.qualifiedDataset?.sampleCount || 0,
          },
          blockers: benchmark.productionBlockers,
          evidenceUri: "/benchmarks",
        });
      },
    ),
    trySignal(
      { id: "retrieval-drift", label: "Retrieval and citation drift", evidenceUri: "/retrieval" },
      () => {
        const retrieval = readRagGovernanceEvidence();
        const checks = {
          localGovernanceRehearsalPassed: retrieval.localStatus === "pass",
          replayEvidenceAvailable: retrieval.summary.replayableEntries > 0,
          citationDiagnosticsAvailable: retrieval.checks.citationDiagnosticsAvailable,
          accessControlRehearsed:
            retrieval.checks.crossWorkspaceDenied &&
            retrieval.checks.unauthorizedSubjectDenied,
        };
        return signal({
          id: "retrieval-drift",
          label: "Retrieval and citation drift",
          summary: `${retrieval.summary.replayableEntries}/${retrieval.summary.replayEntries} retrieval records are replayable with citation and ACL diagnostics.`,
          checks,
          metrics: {
            replayEntries: retrieval.summary.replayEntries,
            replayableEntries: retrieval.summary.replayableEntries,
            enterpriseStatus: retrieval.summary.enterpriseStatus,
          },
          blockers: retrieval.blockers,
          evidenceUri: "/retrieval",
        });
      },
    ),
    trySignal(
      { id: "agent-action-safety", label: "Agent action safety", evidenceUri: "/agent" },
      () => {
        const agent = readAgentActionTrustRecoveryEvidence();
        return signal({
          id: "agent-action-safety",
          label: "Agent action safety",
          summary: `${agent.summary.shadowPassingRuns} protected-action shadow runs; ${agent.summary.duplicateSideEffects} duplicate side effects.`,
          checks: agent.checks,
          metrics: agent.summary,
          blockers: agent.blockers,
          evidenceUri: "/agent",
        });
      },
    ),
    trySignal(
      { id: "workflow-recovery", label: "Workflow recovery", evidenceUri: "/workflows" },
      () => {
        const workflow = readWorkflowExecutionClosureEvidence();
        const latest = workflow.latestPassing;
        const checks = {
          executionClosurePassed: workflow.localStatus === "pass",
          typedExecutorsAvailable: workflow.capabilities.executors.length > 0,
          protectedToolEvidenceAvailable: Boolean(latest?.executions.protectedToolGraphId),
        };
        return signal({
          id: "workflow-recovery",
          label: "Workflow recovery",
          summary: `${workflow.capabilities.executors.length} typed executors; ${workflow.receipts.length} execution-closure receipts.`,
          checks,
          metrics: {
            executors: workflow.capabilities.executors.length,
            receipts: workflow.receipts.length,
            localStatus: workflow.localStatus,
          },
          blockers: latest ? [] : ["No passing workflow execution-closure receipt is available."],
          evidenceUri: "/workflows",
        });
      },
    ),
    trySignal(
      { id: "finetune-roi", label: "Fine-tune quality and ROI", evidenceUri: "/fine-tune" },
      () => {
        const fineTune = readFineTuneQualityExportEvidence();
        const latest = fineTune.latestPassing;
        const checks = {
          pairedQualityPassed: fineTune.localStatus === "pass",
          bestCheckpointPackaged: Boolean(latest?.package?.selectedCheckpointFile),
          packageReadBackVerified: Boolean(latest?.package?.readBackVerified),
          rollbackVerified: Boolean(latest?.package?.rollbackVerified),
        };
        return signal({
          id: "finetune-roi",
          label: "Fine-tune quality and ROI",
          summary: latest?.quality
            ? `${latest.quality.observations} paired observations across ${latest.quality.seeds} seeds; decision ${latest.quality.decision}.`
            : "No passing paired-quality and adapter-package receipt is available.",
          checks,
          metrics: {
            receipts: fineTune.receipts.length,
            observations: latest?.quality?.observations || 0,
            seeds: latest?.quality?.seeds || 0,
            decision: latest?.quality?.decision || "evidence-needed",
          },
          blockers: latest?.blockers || ["A passing real paired-quality and adapter-package receipt is required."],
          evidenceUri: "/fine-tune",
        });
      },
    ),
    externalOnlySignal("independent-ops-review", "Independent AI operations review"),
    trySignal(
      { id: "deployment-portability", label: "Deployment portability", evidenceUri: "/release" },
      () => {
        const deployment = readDeploymentControlPlane();
        const checks = {
          targetInventoryAvailable: deployment.targets.length > 0,
          registryReadOnly: deployment.controlPlane.registry.readOnly,
          portableEvidencePathsDeclared: deployment.evidence.length >= 4,
          localControlPlaneReady: deployment.localReadiness.completionPct === 100,
        };
        return signal({
          id: "deployment-portability",
          label: "Deployment portability",
          summary: `${deployment.targets.length} deployment targets and ${deployment.evidence.length} evidence locations are projected by the control plane.`,
          checks,
          metrics: {
            targets: deployment.targets.length,
            localCompletionPct: deployment.localReadiness.completionPct,
            revision: deployment.revision,
          },
          blockers: deployment.localReadiness.blockers,
          evidenceUri: "/release",
        });
      },
    ),
    trySignal(
      { id: "data-sovereignty", label: "Data residency and sovereignty", evidenceUri: "/retrieval" },
      () => {
        const enterprise = readEnterpriseRetrievalReadModel();
        const checks = {
          databaseConfigured: enterprise.checks.databaseConfigured,
          embeddingConfigured: enterprise.checks.embeddingConfigured,
          rerankerConfigured: enterprise.checks.rerankerConfigured,
          databaseAclContractPresent: enterprise.capabilities.acl === "postgres-rls-subject-groups",
        };
        return signal({
          id: "data-sovereignty",
          label: "Data residency and sovereignty",
          summary: `Enterprise Retrieval is ${enterprise.status}; vector, embedding, reranker, citation, and RLS boundaries are projected separately.`,
          checks,
          metrics: {
            enterpriseStatus: enterprise.status,
            vectorStore: enterprise.capabilities.vectorStore,
            embeddings: enterprise.capabilities.embeddings,
            reranker: enterprise.capabilities.reranker,
          },
          blockers: enterprise.blockers,
          evidenceUri: "/retrieval",
        });
      },
    ),
    trySignal(
      { id: "customer-keys", label: "Customer-controlled keys", evidenceUri: "/release" },
      () => {
        const deployment = readDeploymentControlPlane();
        const kms = deployment.controlPlane.kmsSigning;
        const checks = {
          signedReceiptAvailable: kms.receipts > 0,
          receiptCryptographicallyVerified: kms.verifiedReceipts > 0,
          signerIdentityRecorded: Boolean(kms.latestKeyId),
          cloudSubstitutionDenied: true,
        };
        return signal({
          id: "customer-keys",
          label: "Customer-controlled keys",
          summary: `${kms.verifiedReceipts}/${kms.receipts} signing receipts verify locally; ${kms.verifiedCloudReceipts} are cloud-backed.`,
          checks,
          metrics: {
            signerMode: kms.signerMode,
            receipts: kms.receipts,
            verifiedReceipts: kms.verifiedReceipts,
            verifiedCloudReceipts: kms.verifiedCloudReceipts,
          },
          blockers: [
            ...(checks.signedReceiptAvailable ? [] : ["No signed deployment receipt is available."]),
            ...(checks.receiptCryptographicallyVerified ? [] : ["No deployment receipt verifies cryptographically."]),
            ...(checks.signerIdentityRecorded ? [] : ["No signer key identity is recorded."]),
            "Local Ed25519 evidence does not satisfy a customer-controlled cloud KMS or HSM requirement.",
          ],
          evidenceUri: "/release",
        });
      },
    ),
    trySignal(
      { id: "continuity-exit", label: "Continuity and exit rehearsal", evidenceUri: "/release" },
      () => {
        const deployment = readDeploymentControlPlane();
        const failover = deployment.controlPlane.failover;
        const checks = {
          failoverRehearsalAvailable: failover.rehearsals > 0,
          rpoMeasured: typeof failover.latestRpoMs === "number",
          rtoMeasured: typeof failover.latestRtoMs === "number",
          auditLineageAvailable: deployment.controlPlane.auditArchive.archivedEvents > 0,
        };
        return signal({
          id: "continuity-exit",
          label: "Continuity and exit rehearsal",
          summary: `${failover.rehearsals} failover rehearsals; latest RPO ${failover.latestRpoMs ?? "--"}ms and RTO ${failover.latestRtoMs ?? "--"}ms.`,
          checks,
          metrics: {
            rehearsals: failover.rehearsals,
            latestRpoMs: failover.latestRpoMs ?? null,
            latestRtoMs: failover.latestRtoMs ?? null,
            archivedEvents: deployment.controlPlane.auditArchive.archivedEvents,
          },
          blockers: [
            ...(checks.failoverRehearsalAvailable ? [] : ["No failover rehearsal is recorded."]),
            ...(checks.rpoMeasured ? [] : ["RPO is not measured."]),
            ...(checks.rtoMeasured ? [] : ["RTO is not measured."]),
            ...(checks.auditLineageAvailable ? [] : ["No audit archive lineage is available."]),
          ],
          evidenceUri: "/release",
        });
      },
    ),
    externalOnlySignal(
      "independent-lifecycle-review",
      "Independent deployment lifecycle review",
    ),
  ];

  return buildOperationalSourceSignalSnapshot(signals);
}
