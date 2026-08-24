import { createHash, randomUUID } from "node:crypto";

import { readDesktopDataLifecycleEvidence } from "@/features/desktop/data-lifecycle";
import { readDesktopPermissionRepairEvidence } from "@/features/desktop/permission-repair";
import { readDesktopServiceSupervisorEvidence } from "@/features/desktop/service-supervisor";
import { readDesktopUpdateChannelEvidence } from "@/features/desktop/update-channel";
import { readQualityCiGateEvidence } from "@/features/evaluation/quality-ci-gate";
import { readReleaseSecurityEvidence } from "@/features/experiments/release-security-evidence";
import { readGovernanceAccessReviewEvidence } from "@/features/governance/access-review";
import { readSharedAssetAuditEvidence } from "@/features/governance/shared-asset-audit";
import { readHubSessionReconciliationEvidence } from "@/features/models/hub-session-reconciliation";
import { readHubTransferSessions } from "@/features/models/hub-transfer-session";
import { readServerAccessControlEvidence } from "@/features/models/server-access-control";
import { readEnterpriseRetrievalReadModel } from "@/features/retrieval/enterprise-service";
import { readOpenAiCompatibleConformance } from "@/features/runtime/openai-compatible-conformance";
import { readTelemetryEvidence } from "@/features/telemetry/trace-adapter";
import { readWorkflowDeploymentAccessEvidence } from "@/features/workflows/deployment-access";
import { readWorkflowExecutionClosureEvidence } from "@/features/workflows/execution-closure-acceptance";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export const V171_V190_SOURCE_TRAIN_SCHEMA_VERSION =
  "experiments.v171-v190-source-train.v1" as const;
const STORE_SCHEMA_VERSION = "experiments.v171-v190-source-train-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath(
  "experiments",
  "v1.7.1-v1.9.0-source-train.json",
);

type Status = "pass" | "hold";
type SourceTrainVersion = {
  version: "v1.7.1" | "v1.7.2" | "v1.7.3" | "v1.7.4" | "v1.7.5" | "v1.8.0" | "v1.8.1" | "v1.8.2" | "v1.8.3" | "v1.9.0";
  label: string;
  sourceStatus: "pass";
  localStatus: Status;
  externalStatus: "hold";
  productionStatus: "hold";
  sourceContracts: string[];
  localEvidence: string;
  externalBlocker: string;
};

export type V171V190SourceTrainState = {
  localStatus: Status;
  productionStatus: "hold";
  versions: SourceTrainVersion[];
  totals: { versions: 10; sourceContractsPassed: 10; localPassed: number; localHeld: number; externalHeld: 10 };
  blockers: string[];
  disclosure: string;
  stateDigest: string;
};

export type V171V190SourceTrainReceipt = V171V190SourceTrainState & {
  id: string;
  generatedAt: string;
  evidenceDigest: string;
};

type Inputs = {
  enterprise: ReturnType<typeof readEnterpriseRetrievalReadModel>;
  telemetry: ReturnType<typeof readTelemetryEvidence>;
  serverAccess: ReturnType<typeof readServerAccessControlEvidence>;
  workflowAccess: ReturnType<typeof readWorkflowDeploymentAccessEvidence>;
  openAi: ReturnType<typeof readOpenAiCompatibleConformance>;
  hub: ReturnType<typeof readHubTransferSessions>;
  hubReconciliation: ReturnType<typeof readHubSessionReconciliationEvidence>;
  workflow: ReturnType<typeof readWorkflowExecutionClosureEvidence>;
  collaboration: ReturnType<typeof readSharedAssetAuditEvidence>;
  accessReview: ReturnType<typeof readGovernanceAccessReviewEvidence>;
  qualityCi: ReturnType<typeof readQualityCiGateEvidence>;
  releaseSecurity: ReturnType<typeof readReleaseSecurityEvidence>;
  desktopData: ReturnType<typeof readDesktopDataLifecycleEvidence>;
  desktopPermissions: ReturnType<typeof readDesktopPermissionRepairEvidence>;
  desktopServices: ReturnType<typeof readDesktopServiceSupervisorEvidence>;
  desktopUpdates: ReturnType<typeof readDesktopUpdateChannelEvidence>;
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

/**
 * This is deliberately a source-contract projection. A pass means the local
 * implementation boundary exists and is testable; it does not mean a managed
 * service, an Apple receipt, or an organization acceptance has been obtained.
 */
export function buildV171V190SourceTrainState(input: Inputs): V171V190SourceTrainState {
  const versions: SourceTrainVersion[] = [
    {
      version: "v1.7.1",
      label: "Enterprise Data Plane",
      sourceStatus: "pass",
      localStatus:
        input.enterprise.status === "configured" && input.telemetry.config.enabled && Boolean(input.serverAccess.latestPassing)
          ? "pass"
          : "hold",
      externalStatus: "hold",
      productionStatus: "hold",
      sourceContracts: ["pgvector hybrid retrieval + PostgreSQL RLS", "OTLP/Langfuse adapter and redacted receipts", "digest-only API key attribution ledger"],
      localEvidence: `${input.enterprise.status} retrieval; ${input.telemetry.config.exporter} telemetry; ${input.serverAccess.totals.active} active local server key(s).`,
      externalBlocker: "A real vector database, embedding/reranker, collector delivery, managed API quota/rate controls, and end-to-end leakage evidence are not configured here.",
    },
    {
      version: "v1.7.2",
      label: "Release and Production Promotion",
      sourceStatus: "pass",
      localStatus: input.releaseSecurity.status === "pass" ? "pass" : "hold",
      externalStatus: "hold",
      productionStatus: "hold",
      sourceContracts: ["release security evidence integrity", "versioned promotion contract", "external promotion fails closed"],
      localEvidence: `Release security status: ${input.releaseSecurity.status}.`,
      externalBlocker: "Developer ID notarization, managed identity/data plane, cross-region failover, and independent organization sign-off require external receipts.",
    },
    {
      version: "v1.7.3",
      label: "Developer API Reliability",
      sourceStatus: "pass",
      localStatus: Boolean(input.openAi.reports?.some((report) => report.ok) && input.workflowAccess.latestPassing) ? "pass" : "hold",
      externalStatus: "hold",
      productionStatus: "hold",
      sourceContracts: ["OpenAI-compatible conformance port", "version/scoped deployment keys", "request attribution boundary"],
      localEvidence: `${input.openAi.reports?.length || 0} conformance receipt(s); workflow key rehearsal ${input.workflowAccess.latestPassing ? "present" : "absent"}.`,
      externalBlocker: "SDK parity, streaming cancellation/backpressure, load behavior, and managed quota accounting need live multi-client evidence.",
    },
    {
      version: "v1.7.4",
      label: "Model Supply Chain",
      sourceStatus: "pass",
      localStatus: Boolean(input.hub.latestPassing && input.hubReconciliation.latestPassing) ? "pass" : "hold",
      externalStatus: "hold",
      productionStatus: "hold",
      sourceContracts: ["immutable revision + multi-file transfer", "checksum/provenance receipt", "session reconciliation and recovery"],
      localEvidence: `${input.hub.sessions.length} transfer session(s); reconciliation receipt ${input.hubReconciliation.latestPassing ? "present" : "absent"}.`,
      externalBlocker: "Signed cross-hub transfer, real conversion executors, migration/corruption recovery, and an organization trust root require external artifacts.",
    },
    {
      version: "v1.7.5",
      label: "RAG Governance and Quality",
      sourceStatus: "pass",
      localStatus: input.enterprise.status === "configured" ? "pass" : "hold",
      externalStatus: "hold",
      productionStatus: "hold",
      sourceContracts: ["workspace/subject/group RLS", "hybrid recall + cross-encoder rerank", "citation-capable retrieval response"],
      localEvidence: `Enterprise retrieval is ${input.enterprise.status}; ACL capability is ${input.enterprise.capabilities.acl}.`,
      externalBlocker: "Versioned corpora, connector lineage, deletion propagation, leakage suites, and freshness SLOs need a deployed corpus and identities.",
    },
    {
      version: "v1.8.0",
      label: "Agent Runtime Graph",
      sourceStatus: "pass",
      localStatus: input.workflow.localStatus === "pass" ? "pass" : "hold",
      externalStatus: "hold",
      productionStatus: "hold",
      sourceContracts: ["typed node executor registry", "persisted execution reducer", "protected-effect recovery boundary"],
      localEvidence: `Workflow closure local status: ${input.workflow.localStatus}.`,
      externalBlocker: "Shadow-equivalence, duplicate-side-effect, latency/cost comparison, and separate-worker recovery need a deployed workload.",
    },
    {
      version: "v1.8.1",
      label: "Collaborative Experiments",
      sourceStatus: "pass",
      localStatus: Boolean(input.collaboration.latestPassing && input.accessReview.latestPassing) ? "pass" : "hold",
      externalStatus: "hold",
      productionStatus: "hold",
      sourceContracts: ["workspace isolation audit chain", "independent access review", "immutable evidence export"],
      localEvidence: `Shared-asset audit ${input.collaboration.latestPassing ? "present" : "absent"}; access review ${input.accessReview.latestPassing ? "present" : "absent"}.`,
      externalBlocker: "Concurrent multi-user revisions, approval ownership, retention/restore, and organization identity integration need real workspace traffic.",
    },
    {
      version: "v1.8.2",
      label: "Quality CI and Safety",
      sourceStatus: "pass",
      localStatus: input.qualityCi.latestPassing ? "pass" : "hold",
      externalStatus: "hold",
      productionStatus: "hold",
      sourceContracts: ["pinned quality decision digest", "multi-seed paired confidence", "judge calibration and production HOLD"],
      localEvidence: `Quality CI receipt ${input.qualityCi.latestPassing ? "present" : "absent"}.`,
      externalBlocker: "Repository checks, calibrated human/safety evaluation, waiver ownership, rollback, and protected release policy require shared CI governance.",
    },
    {
      version: "v1.8.3",
      label: "Observability and FinOps",
      sourceStatus: "pass",
      localStatus: input.telemetry.config.enabled && input.telemetry.totals.scheduledForExport > 0 ? "pass" : "hold",
      externalStatus: "hold",
      productionStatus: "hold",
      sourceContracts: ["Provider/Workflow/Retrieval/Benchmark/Fine-tune span boundaries", "durable redacted receipts", "usage-ledger integration point"],
      localEvidence: `${input.telemetry.totals.spans} span receipt(s), ${input.telemetry.totals.scheduledForExport} scheduled for export.`,
      externalBlocker: "Durable collector delivery, trace-to-cost reconciliation, SLO alerts, redaction restore, and incident evidence need managed infrastructure.",
    },
    {
      version: "v1.9.0",
      label: "Desktop Distribution GA",
      sourceStatus: "pass",
      localStatus: Boolean(input.desktopData.latestPassing && input.desktopPermissions.latestPassing && input.desktopServices.latestPassing && input.desktopUpdates.latestPassing) ? "pass" : "hold",
      externalStatus: "hold",
      productionStatus: "hold",
      sourceContracts: ["data lifecycle + uninstall rehearsal", "permission recovery", "signed update/rollback channel"],
      localEvidence: `Desktop local receipts: data=${Boolean(input.desktopData.latestPassing)}, permissions=${Boolean(input.desktopPermissions.latestPassing)}, services=${Boolean(input.desktopServices.latestPassing)}, updates=${Boolean(input.desktopUpdates.latestPassing)}.`,
      externalBlocker: "A real Developer ID signature, notarization/staple/Gatekeeper, and independent clean-machine acceptance remain external gates.",
    },
  ];
  const localPassed = versions.filter((entry) => entry.localStatus === "pass").length;
  const blockers = unique([
    ...versions.filter((entry) => entry.localStatus === "hold").map((entry) => `${entry.version}: local receipt is incomplete. ${entry.localEvidence}`),
    ...versions.map((entry) => `${entry.version}: ${entry.externalBlocker}`),
  ]);
  const withoutDigest = {
    localStatus: localPassed === versions.length ? ("pass" as const) : ("hold" as const),
    productionStatus: "hold" as const,
    versions,
    totals: { versions: 10 as const, sourceContractsPassed: 10 as const, localPassed, localHeld: 10 - localPassed, externalHeld: 10 as const },
    blockers,
    disclosure: "All ten source contracts are implemented and compile-tested. The panel does not promote any version: configured services, external delivery, production security, Apple signing, and independent acceptance remain separate HOLD gates.",
  };
  return { ...withoutDigest, stateDigest: digest(withoutDigest) };
}

function readCurrentState() {
  return buildV171V190SourceTrainState({
    enterprise: readEnterpriseRetrievalReadModel(), telemetry: readTelemetryEvidence(), serverAccess: readServerAccessControlEvidence(), workflowAccess: readWorkflowDeploymentAccessEvidence(), openAi: readOpenAiCompatibleConformance(), hub: readHubTransferSessions(), hubReconciliation: readHubSessionReconciliationEvidence(), workflow: readWorkflowExecutionClosureEvidence(), collaboration: readSharedAssetAuditEvidence(), accessReview: readGovernanceAccessReviewEvidence(), qualityCi: readQualityCiGateEvidence(), releaseSecurity: readReleaseSecurityEvidence(), desktopData: readDesktopDataLifecycleEvidence(), desktopPermissions: readDesktopPermissionRepairEvidence(), desktopServices: readDesktopServiceSupervisorEvidence(), desktopUpdates: readDesktopUpdateChannelEvidence(),
  });
}

export function runV171V190SourceTrainAcceptance() {
  const state = readCurrentState();
  const withoutDigest = { id: `v171-v190-source-train-${randomUUID()}`, generatedAt: new Date().toISOString(), ...state };
  const receipt: V171V190SourceTrainReceipt = { ...withoutDigest, evidenceDigest: digest(withoutDigest) };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 30);
  return receipt;
}

export function readV171V190SourceTrainEvidence() {
  const receipts = readDurableReceipts<V171V190SourceTrainReceipt>(RECEIPT_PATH, STORE_SCHEMA_VERSION);
  const current = readCurrentState();
  const latest = receipts[0] || null;
  return { ok: true as const, schemaVersion: V171_V190_SOURCE_TRAIN_SCHEMA_VERSION, generatedAt: new Date().toISOString(), ...current, latest: latest?.stateDigest === current.stateDigest ? latest : null, latestPassing: receipts.find((receipt) => receipt.localStatus === "pass") || null, receipts, receiptPath: RECEIPT_PATH };
}
