import { createHash, randomUUID } from "node:crypto";

import { readArtifactPublisherTrustRegistry } from "@/features/artifacts/publisher-trust-registry";
import { readArtifactFederationTrustEvidence } from "@/features/artifacts/federation-trust-evidence";
import { readAgentActionTrustRecoveryEvidence } from "@/features/agent/action-trust-recovery-evidence";
import { readArtifactRegistryAdapterCatalog } from "@/features/artifacts/registry-adapters";
import { readDeploymentControlPlane } from "@/features/deployment/control-plane";
import { readEnterpriseControlPlaneCandidateEvidence } from "@/features/deployment/enterprise-control-plane-candidate";
import { readHaFinOpsReadiness } from "@/features/deployment/ha-finops-readiness";
import { readQualityArtifactBindingEvidence } from "@/features/evaluation/quality-artifact-binding";
import { readQualityCiGateEvidence } from "@/features/evaluation/quality-ci-gate";
import { readEvaluationRegressionSuiteEvidence } from "@/features/evaluation/regression-suite";
import { readQualityPolicySafetyReviewEvidence } from "@/features/evaluation/quality-policy-safety-review";
import { readFineTuneQualityExportEvidence } from "@/features/finetune/quality-export-acceptance";
import { readReproducibleTrainingRecipeEvidence } from "@/features/finetune/reproducible-training-recipe-evidence";
import { readTrainingCapabilityRegistry } from "@/features/finetune/training-capabilities";
import { readReleaseSecurityEvidence } from "@/features/experiments/release-security-evidence";
import { readEnterpriseIdentityAcceptanceEvidence } from "@/features/governance/enterprise-identity-acceptance";
import { readWorkspaceActionProvenanceEvidence } from "@/features/governance/workspace-action-provenance";
import { readWorkspaceRequestContextReadiness } from "@/features/governance/workspace-request-context";
import { readModelContentDedupEvidence } from "@/features/models/content-deduplication";
import { readHubSessionReconciliationEvidence } from "@/features/models/hub-session-reconciliation";
import { readHubTransferSessions } from "@/features/models/hub-transfer-session";
import { readModelRuntimeOperations } from "@/features/models/runtime-profile-registry";
import { readRuntimeRecoveryPerformanceEvidence } from "@/features/models/runtime-recovery-performance";
import { readModelSupplyChainOperationsEvidence } from "@/features/models/supply-chain-operations-evidence";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";
import { readEnterpriseRetrievalReadModel } from "@/features/retrieval/enterprise-service";
import { readRetrievalQueryReplaySummary } from "@/features/retrieval/query-replay-store";
import { readRagGovernanceEvidence } from "@/features/retrieval/rag-governance-evidence";
import { readLangGraphShadowEvidence } from "@/features/workflows/langgraph-shadow-service";
import { readWorkflowExecutionClosureEvidence } from "@/features/workflows/execution-closure-acceptance";
import { readWorkflowDebuggerClosureEvidence } from "@/features/workflows/debugger-closure-evidence";
import { readWorkflowReplayEvidence } from "@/features/workflows/replay-service";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export const V1102_V1200_SOURCE_TRAIN_SCHEMA_VERSION =
  "experiments.v1102-v1200-source-train.v1" as const;
const STORE_SCHEMA_VERSION =
  "experiments.v1102-v1200-source-train-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath(
  "experiments",
  "v1.10.2-v1.12.0-source-train.json",
);

type Status = "pass" | "hold";
type VersionId =
  | "v1.10.2"
  | "v1.10.3"
  | "v1.10.4"
  | "v1.10.5"
  | "v1.11.0"
  | "v1.11.1"
  | "v1.11.2"
  | "v1.11.3"
  | "v1.11.4"
  | "v1.12.0";

type SourceTrainVersion = {
  version: VersionId;
  label: string;
  sourceStatus: "pass";
  localStatus: Status;
  externalStatus: "hold";
  productionStatus: "hold";
  sourceContracts: string[];
  localEvidence: string;
  externalBlocker: string;
};

export type V1102V1200SourceTrainState = {
  localStatus: Status;
  productionStatus: "hold";
  versions: SourceTrainVersion[];
  totals: {
    versions: 10;
    sourceContractsPassed: 10;
    localPassed: number;
    localHeld: number;
    externalHeld: 10;
  };
  blockers: string[];
  disclosure: string;
  stateDigest: string;
};

export type V1102V1200SourceTrainReceipt =
  V1102V1200SourceTrainState & {
    id: string;
    generatedAt: string;
    evidenceDigest: string;
  };

type Inputs = {
  runtime: ReturnType<typeof readModelRuntimeOperations>;
  runtimeRecoveryPerformance: ReturnType<typeof readRuntimeRecoveryPerformanceEvidence>;
  workspace: ReturnType<typeof readWorkspaceRequestContextReadiness>;
  workspaceProvenance: ReturnType<typeof readWorkspaceActionProvenanceEvidence>;
  agentActionTrust: ReturnType<typeof readAgentActionTrustRecoveryEvidence>;
  agentShadow: ReturnType<typeof readLangGraphShadowEvidence>;
  workflowReplay: ReturnType<typeof readWorkflowReplayEvidence>;
  workflowClosure: ReturnType<typeof readWorkflowExecutionClosureEvidence>;
  workflowDebugger: ReturnType<typeof readWorkflowDebuggerClosureEvidence>;
  artifactCatalog: ReturnType<typeof readArtifactRegistryAdapterCatalog>;
  artifactTrust: ReturnType<typeof readArtifactPublisherTrustRegistry>;
  artifactFederation: ReturnType<typeof readArtifactFederationTrustEvidence>;
  hub: ReturnType<typeof readHubTransferSessions>;
  hubReconciliation: ReturnType<typeof readHubSessionReconciliationEvidence>;
  modelDeduplication: ReturnType<typeof readModelContentDedupEvidence>;
  modelSupplyChain: ReturnType<typeof readModelSupplyChainOperationsEvidence>;
  enterpriseRetrieval: ReturnType<typeof readEnterpriseRetrievalReadModel>;
  retrievalReplay: ReturnType<typeof readRetrievalQueryReplaySummary>;
  ragGovernance: ReturnType<typeof readRagGovernanceEvidence>;
  training: ReturnType<typeof readTrainingCapabilityRegistry>;
  fineTuneQuality: ReturnType<typeof readFineTuneQualityExportEvidence>;
  trainingRecipes: ReturnType<typeof readReproducibleTrainingRecipeEvidence>;
  qualityCi: ReturnType<typeof readQualityCiGateEvidence>;
  qualityArtifact: ReturnType<typeof readQualityArtifactBindingEvidence>;
  regression: ReturnType<typeof readEvaluationRegressionSuiteEvidence>;
  qualitySafety: ReturnType<typeof readQualityPolicySafetyReviewEvidence>;
  deployment: ReturnType<typeof readDeploymentControlPlane>;
  enterpriseControlPlane: ReturnType<typeof readEnterpriseControlPlaneCandidateEvidence>;
  haFinOps: ReturnType<typeof readHaFinOpsReadiness>;
  enterpriseIdentity: ReturnType<typeof readEnterpriseIdentityAcceptanceEvidence>;
  releaseSecurity: ReturnType<typeof readReleaseSecurityEvidence>;
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

/**
 * A source-contract projection for the ten versions following v1.10.1.
 * Passing source status means the repository-owned boundaries exist and are
 * wired into one auditable read model. It does not turn previews, fixtures,
 * local receipts, or external dependencies into a production release.
 */
export function buildV1102V1200SourceTrainState(
  input: Inputs,
): V1102V1200SourceTrainState {
  const versions: SourceTrainVersion[] = [
    {
      version: "v1.10.2",
      label: "Runtime Recovery and Performance Evidence",
      sourceStatus: "pass",
      localStatus:
        input.runtime.registry.profiles.length > 0 &&
        input.runtime.targetCards.length > 0 &&
        input.runtimeRecoveryPerformance.localStatus === "pass"
          ? "pass"
          : "hold",
      externalStatus: "hold",
      productionStatus: "hold",
      sourceContracts: [
        "versioned runtime profiles and model locality",
        "persisted load/unload/restart/cancel/resume/benchmark recovery checkpoints",
        "same-profile performance receipts with TTFT, tokens/s, memory, queue wait, and repeated-context evidence",
        "fail-closed comparison keys for runtime, profile, hardware, and prompt digests",
      ],
      localEvidence: `${input.runtime.registry.profiles.length} runtime profile(s); ${input.runtime.targetCards.length} target card(s); ${input.runtimeRecoveryPerformance.performance.completeReceipts} complete performance receipt(s); comparison ${input.runtimeRecoveryPerformance.performance.comparison.status}; recovery operations ${input.runtimeRecoveryPerformance.recovery.observedOperations.length}/6; restart-safe ${input.runtimeRecoveryPerformance.recovery.restartSafe}.`,
      externalBlocker:
        "Same-hardware repeated-context measurement, clean-machine recovery, and independently reviewed Apple Silicon performance receipts are still required.",
    },
    {
      version: "v1.10.3",
      label: "Workspace Provenance and Operator Context",
      sourceStatus: "pass",
      localStatus:
        (input.workspace.mode === "loopback-local" || input.workspace.signedProxyConfigured) &&
        input.workspaceProvenance.localStatus === "pass"
        ? "pass"
        : "hold",
      externalStatus: "hold",
      productionStatus: "hold",
      sourceContracts: [
        "loopback-only workspace identity fallback",
        "signed identity-proxy context verification",
        "foreground workspace/organization/subject/request and execution-locality projection",
        "digest-only durable provenance receipt boundary",
      ],
      localEvidence: `Workspace request context mode: ${input.workspace.mode}; signed proxy configured: ${input.workspace.signedProxyConfigured}; provenance receipt ${input.workspaceProvenance.latestPassing ? "present" : "absent"}; local status ${input.workspaceProvenance.localStatus}.`,
      externalBlocker:
        "A real OIDC issuer, rotating JWKS, SCIM lifecycle, non-loopback traffic, and organization-owned identity acceptance are externally controlled.",
    },
    {
      version: "v1.10.4",
      label: "Agent Action Trust and Recovery",
      sourceStatus: "pass",
      localStatus:
        input.agentActionTrust.localStatus === "pass"
          ? "pass"
          : "hold",
      externalStatus: "hold",
      productionStatus: "hold",
      sourceContracts: [
        "protected-tool approval interruption",
        "idempotent resume and duplicate-side-effect accounting",
        "replay fork and breakpoint state diff that omit side effects",
        "foreground action-trust and recovery projection",
      ],
      localEvidence: `${input.agentActionTrust.summary.shadowPassingRuns} protected-action shadow pass(es); ${input.agentActionTrust.summary.duplicateSideEffects} duplicate side effect(s); replay receipt ${input.agentActionTrust.summary.replayReceiptId ? "present" : "absent"}; state diff ${input.agentActionTrust.summary.stateDiffReceiptId ? "present" : "absent"}; local status ${input.agentActionTrust.localStatus}.`,
      externalBlocker:
        "Real streaming reconnect, multi-client cancellation, human approval usability, and billing/quota reconciliation need live workloads and review owners.",
    },
    {
      version: "v1.10.5",
      label: "Workflow Debugger Closure",
      sourceStatus: "pass",
      localStatus:
        input.workflowClosure.localStatus === "pass" &&
        input.workflowDebugger.localStatus === "pass"
          ? "pass"
          : "hold",
      externalStatus: "hold",
      productionStatus: "hold",
      sourceContracts: [
        "typed node executor and graph-version binding",
        "log/error-to-node locator with immutable graph digest",
        "redacted input/output/error cards and trace navigation",
        "checkpoint/replay boundary with protected effects and controlled resume",
      ],
      localEvidence: `Workflow closure local status: ${input.workflowClosure.localStatus}; debugger local status: ${input.workflowDebugger.localStatus}; replay receipt ${input.workflowDebugger.replayBoundary.replay?.id || "absent"}; state diff ${input.workflowDebugger.replayBoundary.stateDiff?.id || "absent"}.`,
      externalBlocker:
        "Redacted production trace inspection, durable distributed checkpointer, browser workflow acceptance, and operator replay recovery acceptance require deployed workflow traffic.",
    },
    {
      version: "v1.11.0",
      label: "Artifact Federation Trust",
      sourceStatus: "pass",
      localStatus:
        input.artifactCatalog.totals.targets > 0 &&
        input.artifactCatalog.policy.remoteRoundTripReceiptRequired &&
        input.artifactTrust.ok &&
        input.artifactFederation.localStatus === "pass"
          ? "pass"
          : "hold",
      externalStatus: "hold",
      productionStatus: "hold",
      sourceContracts: [
        "registry adapter catalog with immutable coordinates",
        "publisher trust-root registry",
        "signed immutable read-back required before promotion",
        "local revoked/tampered denial and trusted atomic-install evidence",
      ],
      localEvidence: `${input.artifactCatalog.totals.targets} registry target(s); ${input.artifactCatalog.totals.digestVerified} digest-verifying target(s); ${input.artifactFederation.summary.activeTrustRoots} active and ${input.artifactFederation.summary.revokedTrustRoots} revoked trust root(s); federation local status ${input.artifactFederation.localStatus}; signed read-back ${input.artifactFederation.summary.signedReadBackReceiptId || "absent"}.`,
      externalBlocker:
        "Independent publisher identities, organization trust roots, provider-side publish/read-back, revocation propagation, and quarantine decisions need controlled registries.",
    },
    {
      version: "v1.11.1",
      label: "Model Supply Chain Operations",
      sourceStatus: "pass",
      localStatus:
        input.modelSupplyChain.localStatus === "pass"
          ? "pass"
          : "hold",
      externalStatus: "hold",
      productionStatus: "hold",
      sourceContracts: [
        "immutable multi-file Hub transfer sessions",
        "interrupted-session reconciliation",
        "content-addressed deduplication, placement, compatibility, and lifecycle evidence",
        "runtime activation rollback and receipt-bound supply-chain operations",
      ],
      localEvidence: `Hub receipt ${input.modelSupplyChain.summary.hubReceiptId || "absent"}; ${input.modelSupplyChain.summary.verifiedHubChecksums}/${input.modelSupplyChain.summary.hubFiles} verified Hub checksum(s); reconciliation ${input.modelSupplyChain.summary.reconciliationReceiptId || "absent"}; supply-chain local status ${input.modelSupplyChain.localStatus}.`,
      externalBlocker:
        "Authenticated multi-hub transfers, conversion executors, external-volume reconnect repair, malware/license review, and organization-managed mirror recovery need real artifact traffic.",
    },
    {
      version: "v1.11.2",
      label: "Continuous RAG Governance",
      sourceStatus: "pass",
      localStatus:
        input.ragGovernance.localStatus === "pass"
          ? "pass"
          : "hold",
      externalStatus: "hold",
      productionStatus: "hold",
      sourceContracts: [
        "ACL-filtered hybrid retrieval and reranking",
        "citation diagnostics and replayable golden-query receipts",
        "version-aware corpus revision, deletion, leakage, and freshness boundary",
      ],
      localEvidence: `Enterprise retrieval is ${input.ragGovernance.summary.enterpriseStatus}; ${input.ragGovernance.summary.replayEntries} replay record(s); ${input.ragGovernance.summary.replayableEntries} replayable result(s); governance local status ${input.ragGovernance.localStatus}.`,
      externalBlocker:
        "Connector ingestion, corpus revisions, deletion propagation through deployed indexes/caches/citations, golden-query SLOs, and identity leakage testing require a managed corpus.",
    },
    {
      version: "v1.11.3",
      label: "Reproducible Training Recipes",
      sourceStatus: "pass",
      localStatus: input.trainingRecipes.localStatus === "pass" ? "pass" : "hold",
      externalStatus: "hold",
      productionStatus: "hold",
      sourceContracts: [
        "backend/method/quantization capability matrix",
        "canonical recipe import/export with base, data, runtime, and evaluator digests",
        "fail-closed preflight, package read-back, rollback, and remote read-back plan",
      ],
      localEvidence: `${input.trainingRecipes.summary.implementedBackends} implemented training backend(s); sample plan ${input.trainingRecipes.summary.samplePlanMode}; quality export ${input.trainingRecipes.summary.qualityExportStatus}; recipe local status ${input.trainingRecipes.localStatus}.`,
      externalBlocker:
        "Production backend execution, recipe import/export across independent workers, model-card review, remote package read-back, and representative quality runs remain external evidence.",
    },
    {
      version: "v1.11.4",
      label: "Quality Policy and Safety Review",
      sourceStatus: "pass",
      localStatus: input.qualitySafety.localStatus === "pass" ? "pass" : "hold",
      externalStatus: "hold",
      productionStatus: "hold",
      sourceContracts: [
        "versioned risk-tier policy and non-inferiority decision boundary",
        "safety, latency, cost, calibration, disagreement, waiver, and rollback controls",
        "Quality CI, artifact binding, and regression evidence joined without rewriting source evidence",
      ],
      localEvidence: `Quality CI ${input.qualitySafety.summary.qualityCiReceiptId || "absent"}; artifact binding ${input.qualitySafety.summary.artifactBindingReceiptId || "absent"}; regression suite ${input.qualitySafety.summary.regressionReceiptId || "absent"}; policy local status ${input.qualitySafety.localStatus}.`,
      externalBlocker:
        "Repository check enforcement, calibrated human/safety judges, expiring waivers with accountable owners, rollback authority, and organization-level red-team review require shared governance.",
    },
    {
      version: "v1.12.0",
      label: "Enterprise Control Plane Candidate",
      sourceStatus: "pass",
      localStatus:
        input.enterpriseControlPlane.localStatus === "pass" ? "pass" : "hold",
      externalStatus: "hold",
      productionStatus: "hold",
      sourceContracts: [
        "revisioned deployment, scoped policy, usage settlement, and hash-bound audit receipt",
        "identity lifecycle, redacted retention, RPO/RTO, and approval boundaries",
        "release-security evidence joined without promoting local cloud substitutes",
      ],
      localEvidence: `Control-plane revision ${input.enterpriseControlPlane.summary.deploymentRevision}; local readiness ${input.enterpriseControlPlane.summary.localReadinessPct}%; cloud ${input.enterpriseControlPlane.summary.cloudConfigured ? "configured" : "unconfigured"}; release security ${input.enterpriseControlPlane.summary.releaseSecurityStatus}; candidate local status ${input.enterpriseControlPlane.localStatus}.`,
      externalBlocker:
        "Managed PostgreSQL, real OIDC/SCIM, cloud KMS/Object Lock, multi-region failover, billing settlement, independent security review, and organization sign-off remain mandatory production gates.",
    },
  ];

  const localPassed = versions.filter(
    (entry) => entry.localStatus === "pass",
  ).length;
  const blockers = unique([
    ...versions
      .filter((entry) => entry.localStatus === "hold")
      .map(
        (entry) =>
          `${entry.version}: local receipt is incomplete. ${entry.localEvidence}`,
      ),
    ...versions.map((entry) => `${entry.version}: ${entry.externalBlocker}`),
  ]);
  const withoutDigest = {
    localStatus: localPassed === versions.length ? ("pass" as const) : ("hold" as const),
    productionStatus: "hold" as const,
    versions,
    totals: {
      versions: 10 as const,
      sourceContractsPassed: 10 as const,
      localPassed,
      localHeld: 10 - localPassed,
      externalHeld: 10 as const,
    },
    blockers,
    disclosure:
      "All ten repository-owned source contracts are wired into this projection. A source pass is not a release: external registries, identity, managed data, Apple distribution, production security, and independent acceptance remain HOLD gates.",
  };
  return { ...withoutDigest, stateDigest: digest(withoutDigest) };
}

function readCurrentState() {
  return buildV1102V1200SourceTrainState({
    runtime: readModelRuntimeOperations(),
    runtimeRecoveryPerformance: readRuntimeRecoveryPerformanceEvidence(),
    workspace: readWorkspaceRequestContextReadiness(),
    workspaceProvenance: readWorkspaceActionProvenanceEvidence(),
    agentActionTrust: readAgentActionTrustRecoveryEvidence(),
    agentShadow: readLangGraphShadowEvidence(),
    workflowReplay: readWorkflowReplayEvidence(),
    workflowClosure: readWorkflowExecutionClosureEvidence(),
    workflowDebugger: readWorkflowDebuggerClosureEvidence(),
    artifactCatalog: readArtifactRegistryAdapterCatalog(),
    artifactTrust: readArtifactPublisherTrustRegistry(),
    artifactFederation: readArtifactFederationTrustEvidence(),
    hub: readHubTransferSessions(),
    hubReconciliation: readHubSessionReconciliationEvidence(),
    modelDeduplication: readModelContentDedupEvidence(),
    modelSupplyChain: readModelSupplyChainOperationsEvidence(),
    enterpriseRetrieval: readEnterpriseRetrievalReadModel(),
    retrievalReplay: readRetrievalQueryReplaySummary(),
    ragGovernance: readRagGovernanceEvidence(),
    training: readTrainingCapabilityRegistry(),
    fineTuneQuality: readFineTuneQualityExportEvidence(),
    trainingRecipes: readReproducibleTrainingRecipeEvidence(),
    qualityCi: readQualityCiGateEvidence(),
    qualityArtifact: readQualityArtifactBindingEvidence(),
    regression: readEvaluationRegressionSuiteEvidence(),
    qualitySafety: readQualityPolicySafetyReviewEvidence(),
    deployment: readDeploymentControlPlane(),
    enterpriseControlPlane: readEnterpriseControlPlaneCandidateEvidence(),
    haFinOps: readHaFinOpsReadiness(),
    enterpriseIdentity: readEnterpriseIdentityAcceptanceEvidence(),
    releaseSecurity: readReleaseSecurityEvidence(),
  });
}

export function runV1102V1200SourceTrainAcceptance() {
  const state = readCurrentState();
  const withoutDigest = {
    id: `v1102-v1200-source-train-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    ...state,
  };
  const receipt: V1102V1200SourceTrainReceipt = {
    ...withoutDigest,
    evidenceDigest: digest(withoutDigest),
  };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 30);
  return receipt;
}

export function readV1102V1200SourceTrainEvidence() {
  const receipts = readDurableReceipts<V1102V1200SourceTrainReceipt>(
    RECEIPT_PATH,
    STORE_SCHEMA_VERSION,
  );
  const current = readCurrentState();
  const latest = receipts[0] || null;
  return {
    ok: true as const,
    schemaVersion: V1102_V1200_SOURCE_TRAIN_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...current,
    latest: latest?.stateDigest === current.stateDigest ? latest : null,
    latestPassing:
      receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    receiptPath: RECEIPT_PATH,
  };
}
