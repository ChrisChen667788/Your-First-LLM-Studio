import { createHash } from "node:crypto";

import { readAdminCompatibilityDeletionManifest } from "@/features/admin/compatibility-deletion-manifest";
import { readAgentActionTrustRecoveryEvidence } from "@/features/agent/action-trust-recovery-evidence";
import { readAgentCheckHistory } from "@/features/agent/check-history-application";
import { readBenchmarkDecisionIntelligence } from "@/features/benchmark/decision-intelligence-service";
import { readDesktopDataLifecycleEvidence } from "@/features/desktop/data-lifecycle";
import { readDesktopPermissionRepairEvidence } from "@/features/desktop/permission-repair";
import { readDesktopServiceSupervisorEvidence } from "@/features/desktop/service-supervisor";
import { readDesktopUpdateChannelEvidence } from "@/features/desktop/update-channel";
import { readFineTuneQualityExportEvidence } from "@/features/finetune/quality-export-acceptance";
import { readWorkspaceAclDatabase } from "@/features/governance/workspace-acl-database";
import { readWorkspaceActionProvenanceEvidence } from "@/features/governance/workspace-action-provenance";
import { readModelSupplyChainOperationsEvidence } from "@/features/models/supply-chain-operations-evidence";
import { readRuntimeRecoveryPerformanceEvidence } from "@/features/models/runtime-recovery-performance";
import { readProviderOpsEvidenceApplication } from "@/features/providers/evidence-application";
import { readRagGovernanceEvidence } from "@/features/retrieval/rag-governance-evidence";
import { readTelemetryEvidence } from "@/features/telemetry/trace-adapter";
import { readRemoteWorkerFailoverEvidence } from "@/features/workflows/remote-worker-failover";
import { readWorkflowWorkerEvidence } from "@/features/workflows/worker-service";

export const OPERATIONAL_SUSTAINABILITY_SOURCE_SIGNALS_SCHEMA_VERSION =
  "experiments.operational-sustainability-source-signals.v1" as const;

export type OperationalSustainabilitySourceSignalId =
  | "provider-traffic-reconciliation"
  | "retrieval-freshness-remediation"
  | "model-supply-chain-reconciliation"
  | "workspace-audit-completeness"
  | "runtime-recovery-efficiency"
  | "agent-session-recovery"
  | "workflow-queue-failover"
  | "benchmark-cost-quality"
  | "finetune-cost-quality-export"
  | "independent-remediation-review"
  | "telemetry-resource-transparency"
  | "incident-diagnostics-retention"
  | "admin-compatibility-sunset"
  | "desktop-upgrade-data-lifecycle"
  | "independent-sustainable-operations-review";

export type OperationalSustainabilitySourceSignalStatus =
  | "pass"
  | "attention"
  | "unavailable"
  | "external-only";

export type OperationalSustainabilitySourceSignal = {
  id: OperationalSustainabilitySourceSignalId;
  label: string;
  status: OperationalSustainabilitySourceSignalStatus;
  summary: string;
  checks: Record<string, boolean>;
  metrics: Record<string, string | number | boolean | null>;
  blockers: string[];
  evidenceUri: string;
};

export type OperationalSustainabilitySourceSignalSnapshot = {
  ok: true;
  schemaVersion: typeof OPERATIONAL_SUSTAINABILITY_SOURCE_SIGNALS_SCHEMA_VERSION;
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
  signals: OperationalSustainabilitySourceSignal[];
  stateDigest: string;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function signal(
  input: Omit<OperationalSustainabilitySourceSignal, "status">,
): OperationalSustainabilitySourceSignal {
  return {
    ...input,
    status: Object.values(input.checks).every(Boolean) ? "pass" : "attention",
  };
}

function externalOnlySignal(
  id: OperationalSustainabilitySourceSignalId,
  label: string,
): OperationalSustainabilitySourceSignal {
  return {
    id,
    label,
    status: "external-only",
    summary: "Only a separately operated and independently signed review may satisfy this milestone.",
    checks: { localSubstitutionDenied: true },
    metrics: {},
    blockers: [
      "Repository fixtures, local operators, and self-authored receipts cannot replace independent operational authority.",
    ],
    evidenceUri: "/experiments",
  };
}

function unavailableSignal(
  identity: Pick<OperationalSustainabilitySourceSignal, "id" | "label" | "evidenceUri">,
  error: unknown,
): OperationalSustainabilitySourceSignal {
  return {
    ...identity,
    status: "unavailable",
    summary: "The feature-owned read model could not be projected without side effects.",
    checks: { readSucceeded: false },
    metrics: {},
    blockers: [error instanceof Error ? error.message : "Source signal read failed."],
  };
}

function trySignal(
  identity: Pick<OperationalSustainabilitySourceSignal, "id" | "label" | "evidenceUri">,
  reader: () => OperationalSustainabilitySourceSignal,
) {
  try {
    return reader();
  } catch (error) {
    return unavailableSignal(identity, error);
  }
}

export function buildOperationalSustainabilitySourceSignalSnapshot(
  signals: OperationalSustainabilitySourceSignal[],
): OperationalSustainabilitySourceSignalSnapshot {
  const sourceOwned = signals.filter((entry) => entry.status !== "external-only");
  const withoutDigest = {
    ok: true as const,
    schemaVersion: OPERATIONAL_SUSTAINABILITY_SOURCE_SIGNALS_SCHEMA_VERSION,
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

export function readOperationalSustainabilitySourceSignals() {
  const signals: OperationalSustainabilitySourceSignal[] = [
    trySignal(
      { id: "provider-traffic-reconciliation", label: "Provider traffic and fallback reconciliation", evidenceUri: "/admin" },
      () => {
        const evidence = readProviderOpsEvidenceApplication(168);
        const { totals, releaseProbe } = evidence.summary;
        const checks = {
          trafficObserved: totals.totalRequests > 0,
          successfulReleaseProbe: releaseProbe.successCount > 0,
          noActionRequiredProviders: totals.actionRequiredCount === 0,
          snapshotIntegrityValid: evidence.snapshots.integrity.invalidCount === 0,
        };
        return signal({ id: "provider-traffic-reconciliation", label: "Provider traffic and fallback reconciliation", summary: `${totals.totalRequests} requests and ${releaseProbe.successCount} successful release probes are available in the 168-hour evidence window.`, checks, metrics: { providers: totals.providerCount, requests: totals.totalRequests, successRatePct: totals.successRatePct, releaseProbeSuccesses: releaseProbe.successCount, snapshots: evidence.snapshots.totalCount }, blockers: Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => `Provider reconciliation requires attention: ${key}.`), evidenceUri: "/admin" });
      },
    ),
    trySignal(
      { id: "retrieval-freshness-remediation", label: "Retrieval freshness and ACL remediation", evidenceUri: "/retrieval" },
      () => {
        const evidence = readRagGovernanceEvidence();
        const checks = { localGovernancePassing: evidence.localStatus === "pass", enterpriseDependenciesConfigured: evidence.checks.enterpriseDependenciesConfigured, deletionPropagationObserved: evidence.checks.deletionPropagatedToLocalIndex, accessDenialsObserved: evidence.checks.crossWorkspaceDenied && evidence.checks.unauthorizedSubjectDenied, evidenceFresh: evidence.checks.freshnessWithinWindow };
        return signal({ id: "retrieval-freshness-remediation", label: "Retrieval freshness and ACL remediation", summary: `${evidence.summary.replayableEntries}/${evidence.summary.replayEntries} retrieval records are replayable; corpus, citation, deletion, and ACL checks stay visible.`, checks, metrics: { enterpriseStatus: evidence.summary.enterpriseStatus, replayEntries: evidence.summary.replayEntries, replayableEntries: evidence.summary.replayableEntries, receipts: evidence.receipts.length }, blockers: evidence.blockers, evidenceUri: "/retrieval" });
      },
    ),
    trySignal(
      { id: "model-supply-chain-reconciliation", label: "Model supply-chain reconciliation", evidenceUri: "/models" },
      () => {
        const evidence = readModelSupplyChainOperationsEvidence();
        const checks = { supplyChainPassing: evidence.localStatus === "pass", immutableRevisionBound: evidence.checks.immutableAuthenticatedHubReceipt, checksumsReconciled: evidence.checks.multiFileChecksumsBound && evidence.checks.reconciledHubSession, activationRollbackRehearsed: evidence.checks.activationRollbackRehearsed };
        return signal({ id: "model-supply-chain-reconciliation", label: "Model supply-chain reconciliation", summary: `${evidence.summary.verifiedHubChecksums}/${evidence.summary.hubFiles} Hub files are checksum-verified against an immutable source revision.`, checks, metrics: { hubRepository: evidence.summary.hubRepository, hubFiles: evidence.summary.hubFiles, verifiedHubChecksums: evidence.summary.verifiedHubChecksums, receipts: evidence.receipts.length }, blockers: evidence.blockers, evidenceUri: "/models" });
      },
    ),
    trySignal(
      { id: "workspace-audit-completeness", label: "Workspace audit completeness", evidenceUri: "/admin" },
      () => {
        const database = readWorkspaceAclDatabase();
        const provenance = readWorkspaceActionProvenanceEvidence();
        const checks = { migrationsApplied: database.migrationRows.length > 0, sqlAclEnforced: database.localAccess.allowed && database.enforcement === "sql-join-membership-permission-workspace", auditEventsAvailable: database.counts.auditEvents > 0, signedActionProvenance: Boolean(provenance.latestPassing) };
        return signal({ id: "workspace-audit-completeness", label: "Workspace audit completeness", summary: `${database.counts.auditEvents} database audit events and ${provenance.receipts.length} privacy-safe action provenance receipts are available.`, checks, metrics: { migrations: database.migrationRows.length, workspaces: database.counts.workspaces, auditEvents: database.counts.auditEvents, provenanceReceipts: provenance.receipts.length }, blockers: [...Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => `Workspace audit completeness requires attention: ${key}.`), ...provenance.blockers], evidenceUri: "/admin" });
      },
    ),
    trySignal(
      { id: "runtime-recovery-efficiency", label: "Runtime recovery and capacity efficiency", evidenceUri: "/models/runtime" },
      () => {
        const evidence = readRuntimeRecoveryPerformanceEvidence();
        const checks = { runtimeEvidencePassing: evidence.localStatus === "pass", comparablePerformanceReceipts: evidence.performance.comparison.status === "comparable", restartSafe: evidence.recovery.restartSafe, lifecycleOperationsCovered: evidence.recovery.observedOperations.length >= 6 };
        return signal({ id: "runtime-recovery-efficiency", label: "Runtime recovery and capacity efficiency", summary: `${evidence.performance.completeReceipts} complete performance receipts cover ${evidence.recovery.observedOperations.length}/6 runtime lifecycle operations.`, checks, metrics: { completeReceipts: evidence.performance.completeReceipts, comparisonStatus: evidence.performance.comparison.status, observedOperations: evidence.recovery.observedOperations.length, restartSafe: evidence.recovery.restartSafe }, blockers: evidence.blockers, evidenceUri: "/models/runtime" });
      },
    ),
    trySignal(
      { id: "agent-session-recovery", label: "Agent action and session recovery", evidenceUri: "/agent" },
      () => {
        const evidence = readAgentActionTrustRecoveryEvidence();
        const checks = { trustRecoveryPassing: evidence.localStatus === "pass", protectedActionInterrupted: evidence.checks.protectedActionInterrupted, duplicateSideEffectsZero: evidence.checks.noDuplicateSideEffects, replaySideEffectsOmitted: evidence.checks.replayForkOmitsSideEffects };
        return signal({ id: "agent-session-recovery", label: "Agent action and session recovery", summary: `${evidence.summary.shadowPassingRuns} protected-action shadow runs report ${evidence.summary.duplicateSideEffects} duplicate side effects.`, checks, metrics: { shadowPassingRuns: evidence.summary.shadowPassingRuns, duplicateSideEffects: evidence.summary.duplicateSideEffects, receipts: evidence.receipts.length, replayReceiptId: evidence.summary.replayReceiptId }, blockers: evidence.blockers, evidenceUri: "/agent" });
      },
    ),
    trySignal(
      { id: "workflow-queue-failover", label: "Workflow queue and failover efficiency", evidenceUri: "/workflows" },
      () => {
        const worker = readWorkflowWorkerEvidence();
        const failover = readRemoteWorkerFailoverEvidence();
        const checks = { workerReceiptAvailable: worker.totals.receipts > 0, completedExecutionAvailable: worker.totals.completed > 0, noActiveStaleLease: worker.totals.activeLeases === 0, failoverRehearsed: Boolean(failover.latestPassing) };
        return signal({ id: "workflow-queue-failover", label: "Workflow queue and failover efficiency", summary: `${worker.totals.completed}/${worker.totals.receipts} worker receipts completed; durable lease failover remains separately observable.`, checks, metrics: { workerReceipts: worker.totals.receipts, completed: worker.totals.completed, activeLeases: worker.totals.activeLeases, failoverReceipts: failover.receipts.length }, blockers: [...Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => `Workflow queue and failover requires attention: ${key}.`), ...failover.productionBlockers], evidenceUri: "/workflows" });
      },
    ),
    trySignal(
      { id: "benchmark-cost-quality", label: "Benchmark cost-quality decision gate", evidenceUri: "/benchmarks" },
      () => {
        const evidence = readBenchmarkDecisionIntelligence();
        const checks = { completeBaselineAvailable: Boolean(evidence.baseline && evidence.baseline.samples === 500), deterministicAuditComplete: evidence.audit?.accountedSamples === 500, candidateComparisonAvailable: evidence.comparison?.status === "pass", decisionDigestAvailable: Boolean(evidence.decisionDigest) };
        return signal({ id: "benchmark-cost-quality", label: "Benchmark cost-quality decision gate", summary: evidence.baseline ? `${evidence.baseline.samples} scored items bind quality, latency, token outliers, confidence, and candidate non-inferiority.` : "No complete 500-item benchmark baseline is currently eligible.", checks, metrics: { eligibleRuns: evidence.eligibleRuns.length, baselineSamples: evidence.baseline?.samples || 0, comparisonStatus: evidence.comparison?.status || "unavailable", reviewQueue: evidence.audit?.reviewQueue.length || 0 }, blockers: evidence.blockers, evidenceUri: "/benchmarks" });
      },
    ),
    trySignal(
      { id: "finetune-cost-quality-export", label: "Fine-tune cost-quality and export gate", evidenceUri: "/fine-tune" },
      () => {
        const evidence = readFineTuneQualityExportEvidence();
        const checks = { qualityExportPassing: evidence.localStatus === "pass", completeAcceptanceSlices: evidence.latest?.totals.passed === 15, packageBoundToQuality: Boolean(evidence.latest?.package?.archiveSha256), installReadbackVerified: Boolean(evidence.latest?.package?.readBackVerified) };
        return signal({ id: "finetune-cost-quality-export", label: "Fine-tune cost-quality and export gate", summary: `${evidence.latest?.totals.passed || 0}/15 quality and export acceptance slices bind the selected checkpoint to the packaged adapter.`, checks, metrics: { receipts: evidence.receipts.length, passedSlices: evidence.latest?.totals.passed || 0, heldSlices: evidence.latest?.totals.held || 15, archiveSha256: evidence.latest?.package?.archiveSha256 || null }, blockers: evidence.latest?.blockers || ["No fine-tune quality/export acceptance receipt is available."], evidenceUri: "/fine-tune" });
      },
    ),
    externalOnlySignal("independent-remediation-review", "Independent operational remediation review"),
    trySignal(
      { id: "telemetry-resource-transparency", label: "Telemetry and resource transparency", evidenceUri: "/admin" },
      () => {
        const telemetry = readTelemetryEvidence();
        const runtime = readRuntimeRecoveryPerformanceEvidence();
        const checks = { telemetryEnabled: telemetry.config.enabled, exporterConfigured: telemetry.config.exporter !== "disabled" && telemetry.config.endpointConfigured, spansRecorded: telemetry.totals.spans > 0, completeRuntimeMetricsAvailable: runtime.performance.completeReceipts > 0 };
        return signal({ id: "telemetry-resource-transparency", label: "Telemetry and resource transparency", summary: `${telemetry.totals.spans} trace receipts and ${runtime.performance.completeReceipts} complete runtime performance receipts are available.`, checks, metrics: { exporter: telemetry.config.exporter, spans: telemetry.totals.spans, exportScheduled: telemetry.totals.scheduledForExport, traceErrors: telemetry.totals.errors, runtimeReceipts: runtime.performance.completeReceipts }, blockers: [...Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => `Telemetry transparency requires attention: ${key}.`), ...telemetry.config.blockers], evidenceUri: "/admin" });
      },
    ),
    trySignal(
      { id: "incident-diagnostics-retention", label: "Incident diagnostics and evidence retention", evidenceUri: "/admin" },
      () => {
        const checksHistory = readAgentCheckHistory({ limit: 200 });
        const supervisor = readDesktopServiceSupervisorEvidence();
        const provider = readProviderOpsEvidenceApplication(168);
        const checks = { connectionDiagnosticsAvailable: checksHistory.count > 0, supervisorRecoveryRehearsed: Boolean(supervisor.latestPassing), providerSnapshotsRetained: provider.snapshots.totalCount > 0, snapshotIntegrityValid: provider.snapshots.integrity.invalidCount === 0 };
        return signal({ id: "incident-diagnostics-retention", label: "Incident diagnostics and evidence retention", summary: `${checksHistory.count} connection checks, ${supervisor.receipts.length} supervisor receipts, and ${provider.snapshots.totalCount} provider snapshots support incident replay.`, checks, metrics: { connectionChecks: checksHistory.count, supervisorReceipts: supervisor.receipts.length, providerSnapshots: provider.snapshots.totalCount, pinnedProviderSnapshots: provider.snapshots.pinnedCount }, blockers: Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => `Incident diagnostics requires attention: ${key}.`), evidenceUri: "/admin" });
      },
    ),
    trySignal(
      { id: "admin-compatibility-sunset", label: "Admin compatibility sunset readiness", evidenceUri: "/admin" },
      () => {
        const manifest = readAdminCompatibilityDeletionManifest();
        const checks = { canonicalReplacementsComplete: manifest.totals.canonicalReplacementCount === manifest.totals.routeCount, compatibilitySmokeComplete: manifest.routes.every((entry) => entry.smokeCovered), runtimeCallersCleared: manifest.routes.every((entry) => entry.runtimeClear), historicalUsageCleared: manifest.routes.every((entry) => entry.historicalClear) };
        return signal({ id: "admin-compatibility-sunset", label: "Admin compatibility sunset readiness", summary: `${manifest.totals.preSunsetReadyCount}/${manifest.totals.routeCount} compatibility wrappers satisfy the pre-sunset deletion evidence threshold.`, checks, metrics: { wrappers: manifest.totals.wrapperFileCount, canonicalReplacements: manifest.totals.canonicalReplacementCount, preSunsetReady: manifest.totals.preSunsetReadyCount, daysUntilSunset: Math.ceil((Date.parse(manifest.sunsetAt) - Date.now()) / 86_400_000) }, blockers: manifest.preSunsetBlockers, evidenceUri: "/admin" });
      },
    ),
    trySignal(
      { id: "desktop-upgrade-data-lifecycle", label: "Desktop upgrade and data lifecycle assurance", evidenceUri: "/experiments" },
      () => {
        const update = readDesktopUpdateChannelEvidence();
        const lifecycle = readDesktopDataLifecycleEvidence();
        const permissions = readDesktopPermissionRepairEvidence();
        const checks = { signedUpdateRollbackRehearsed: Boolean(update.latestPassing), dataMigrationRestoreRehearsed: Boolean(lifecycle.latestPassing), permissionRepairRehearsed: Boolean(permissions.latestPassing) };
        return signal({ id: "desktop-upgrade-data-lifecycle", label: "Desktop upgrade and data lifecycle assurance", summary: "Signed local update rollback, data migration/restore, and permission repair are retained as separate durable receipts.", checks, metrics: { updateReceipts: update.receipts.length, dataLifecycleReceipts: lifecycle.receipts.length, permissionRepairReceipts: permissions.receipts.length }, blockers: Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => `Desktop upgrade and data lifecycle requires attention: ${key}.`), evidenceUri: "/experiments" });
      },
    ),
    externalOnlySignal("independent-sustainable-operations-review", "Independent sustainable operations closure"),
  ];

  return buildOperationalSustainabilitySourceSignalSnapshot(signals);
}
