import { createHash, randomUUID } from "node:crypto";

import { readEnterpriseRetrievalReadModel } from "@/features/retrieval/enterprise-service";
import { appendRetrievalQueryReplay, readRetrievalQueryReplaySummary } from "@/features/retrieval/query-replay-store";
import { deleteKnowledgeDocument, searchKnowledgeBase, upsertKnowledgeDocument } from "@/lib/agent/retrieval-store";
import { prependDurableReceipt, readDurableReceipts } from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export const RAG_GOVERNANCE_SCHEMA_VERSION = "retrieval.rag-governance.v1" as const;
const STORE_SCHEMA_VERSION = "retrieval.rag-governance-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath("retrieval", "v1.11.2-rag-governance.json");

type Status = "pass" | "hold";
type GovernancePrincipal = { workspaceId: string; subjectId: string; groupIds: string[] };
type GovernanceDocument = { workspaceId: string; allowedSubjects: string[]; allowedGroups: string[] };
type Rehearsal = {
  id: string;
  generatedAt: string;
  corpus: { documentId: string; revisionDigest: string };
  replayIds: { golden: string; deletion: string };
  checks: {
    corpusRevisionBound: boolean;
    goldenQueryGrounded: boolean;
    citationsDiagnosed: boolean;
    deletionPropagatedToLocalIndex: boolean;
    crossWorkspaceDenied: boolean;
    unauthorizedSubjectDenied: boolean;
    authorizedPrincipalAllowed: boolean;
  };
};

export type RagGovernanceState = {
  localStatus: Status;
  productionStatus: "hold";
  checks: {
    enterpriseDependenciesConfigured: boolean;
    queryReplayAvailable: boolean;
    corpusRevisionBound: boolean;
    goldenQueryGrounded: boolean;
    citationDiagnosticsAvailable: boolean;
    deletionPropagatedToLocalIndex: boolean;
    crossWorkspaceDenied: boolean;
    unauthorizedSubjectDenied: boolean;
    authorizedPrincipalAllowed: boolean;
    freshnessWithinWindow: boolean;
  };
  summary: {
    enterpriseStatus: "configured" | "blocked";
    replayEntries: number;
    replayableEntries: number;
    latestReplayId: string | null;
    rehearsal: Rehearsal | null;
  };
  blockers: string[];
  stateDigest: string;
};

export type RagGovernanceReceipt = RagGovernanceState & {
  id: string;
  generatedAt: string;
  evidenceDigest: string;
};

type Inputs = {
  enterprise: ReturnType<typeof readEnterpriseRetrievalReadModel>;
  replay: ReturnType<typeof readRetrievalQueryReplaySummary>;
  rehearsal: Rehearsal | null;
  now?: number;
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** Mirrors the RLS policy shape for an isolated governance probe; it does not substitute for PostgreSQL RLS. */
export function canReadGovernedRetrievalDocument(
  principal: GovernancePrincipal,
  document: GovernanceDocument,
) {
  if (principal.workspaceId !== document.workspaceId) return false;
  if (!document.allowedSubjects.length) return true;
  return document.allowedSubjects.includes(principal.subjectId) ||
    document.allowedGroups.some((group) => principal.groupIds.includes(group));
}

export function buildRagGovernanceState(input: Inputs): RagGovernanceState {
  const rehearsal = input.rehearsal;
  const now = input.now || Date.now();
  const checks = {
    enterpriseDependenciesConfigured: input.enterprise.status === "configured" && input.enterprise.capabilities.acl === "postgres-rls-subject-groups",
    queryReplayAvailable: input.replay.totals.entryCount > 0 && input.replay.totals.replayableCount > 0,
    corpusRevisionBound: Boolean(rehearsal?.checks.corpusRevisionBound),
    goldenQueryGrounded: Boolean(rehearsal?.checks.goldenQueryGrounded),
    citationDiagnosticsAvailable: Boolean(rehearsal?.checks.citationsDiagnosed),
    deletionPropagatedToLocalIndex: Boolean(rehearsal?.checks.deletionPropagatedToLocalIndex),
    crossWorkspaceDenied: Boolean(rehearsal?.checks.crossWorkspaceDenied),
    unauthorizedSubjectDenied: Boolean(rehearsal?.checks.unauthorizedSubjectDenied),
    authorizedPrincipalAllowed: Boolean(rehearsal?.checks.authorizedPrincipalAllowed),
    freshnessWithinWindow: Boolean(rehearsal && now - Date.parse(rehearsal.generatedAt) <= 24 * 60 * 60 * 1_000),
  };
  const blockers = [
    ...(checks.enterpriseDependenciesConfigured ? [] : ["Enterprise pgvector, embedding, reranker, and RLS dependencies are not fully configured."]),
    ...(checks.queryReplayAvailable ? [] : ["No replayable retrieval query record is available."]),
    ...(checks.corpusRevisionBound ? [] : ["No local corpus revision rehearsal is available."]),
    ...(checks.goldenQueryGrounded ? [] : ["No local golden query proves a revision can be grounded."]),
    ...(checks.citationDiagnosticsAvailable ? [] : ["No local citation diagnostic is available for the golden query."]),
    ...(checks.deletionPropagatedToLocalIndex ? [] : ["No local deletion rehearsal proves a removed document disappears from the index."]),
    ...(checks.crossWorkspaceDenied ? [] : ["No local cross-workspace leakage probe is recorded."]),
    ...(checks.unauthorizedSubjectDenied ? [] : ["No local unauthorized-subject leakage probe is recorded."]),
    ...(checks.authorizedPrincipalAllowed ? [] : ["No local authorized-principal retrieval probe is recorded."]),
    ...(checks.freshnessWithinWindow ? [] : ["The latest governance rehearsal is older than the 24-hour freshness window."]),
    "Managed connector ingestion, corpus revision propagation through deployed indexes/caches/citations, real identity leakage probes, deletion SLOs, and golden-query measurement on a managed corpus remain production HOLD gates.",
  ];
  const withoutDigest = {
    localStatus: blockers.length === 1 ? ("pass" as const) : ("hold" as const),
    productionStatus: "hold" as const,
    checks,
    summary: {
      enterpriseStatus: input.enterprise.status,
      replayEntries: input.replay.totals.entryCount,
      replayableEntries: input.replay.totals.replayableCount,
      latestReplayId: input.replay.totals.latestEntryId,
      rehearsal,
    },
    blockers,
  };
  return { ...withoutDigest, stateDigest: digest(withoutDigest) };
}

function readCurrentState(rehearsal: Rehearsal | null) {
  return buildRagGovernanceState({
    enterprise: readEnterpriseRetrievalReadModel(),
    replay: readRetrievalQueryReplaySummary(),
    rehearsal,
  });
}

/** Runs only against the local retrieval index and removes the temporary corpus document before returning. */
export function runRagGovernanceRehearsal() {
  const runId = randomUUID();
  const revisionOne = `continuous RAG governance rehearsal ${runId} revision one`;
  const revisionTwo = `continuous RAG governance rehearsal ${runId} revision two grounded evidence`;
  const initial = upsertKnowledgeDocument({ title: `RAG governance ${runId}`, source: `local://rag-governance/${runId}`, tags: ["governance", "rehearsal"], content: revisionOne });
  const revised = upsertKnowledgeDocument({ id: initial.document.id, title: initial.document.title, source: initial.document.source, tags: initial.document.tags, content: revisionTwo });
  const golden = searchKnowledgeBase(`continuous RAG governance ${runId} revision two`, 4, { scope: "knowledge-base", evidenceMode: "expanded" });
  const goldenReplay = appendRetrievalQueryReplay({ id: `rag-governance-golden-${runId}`, retrieval: golden });
  const deleted = deleteKnowledgeDocument(revised.document.id);
  const afterDeletion = searchKnowledgeBase(`continuous RAG governance ${runId} revision two`, 4, { scope: "knowledge-base", evidenceMode: "compact" });
  const deletionReplay = appendRetrievalQueryReplay({ id: `rag-governance-deletion-${runId}`, retrieval: afterDeletion });
  const governed: GovernanceDocument = { workspaceId: "workspace-a", allowedSubjects: ["subject-a"], allowedGroups: ["group-a"] };
  const rehearsal: Rehearsal = {
    id: `rag-governance-rehearsal-${runId}`,
    generatedAt: new Date().toISOString(),
    corpus: { documentId: revised.document.id, revisionDigest: `sha256:${digest({ id: revised.document.id, updatedAt: revised.document.updatedAt, revisionTwo })}` },
    replayIds: { golden: goldenReplay.id, deletion: deletionReplay.id },
    checks: {
      corpusRevisionBound: initial.document.id === revised.document.id && initial.document.content !== revised.document.content && revised.document.chunkCount > 0,
      goldenQueryGrounded: golden.results.some((result) => result.documentId === revised.document.id) && golden.hitCount > 0,
      citationsDiagnosed: goldenReplay.diagnostics.some((diagnostic) => diagnostic.scope === "citation"),
      deletionPropagatedToLocalIndex: deleted && afterDeletion.results.every((result) => result.documentId !== revised.document.id),
      crossWorkspaceDenied: !canReadGovernedRetrievalDocument({ workspaceId: "workspace-b", subjectId: "subject-a", groupIds: ["group-a"] }, governed),
      unauthorizedSubjectDenied: !canReadGovernedRetrievalDocument({ workspaceId: "workspace-a", subjectId: "subject-b", groupIds: ["group-b"] }, governed),
      authorizedPrincipalAllowed: canReadGovernedRetrievalDocument({ workspaceId: "workspace-a", subjectId: "subject-a", groupIds: [] }, governed),
    },
  };
  const state = readCurrentState(rehearsal);
  const withoutDigest = { id: `rag-governance-${randomUUID()}`, generatedAt: new Date().toISOString(), ...state };
  const receipt: RagGovernanceReceipt = { ...withoutDigest, evidenceDigest: digest(withoutDigest) };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 50);
  return { receipt, rehearsal, goldenReplay, deletionReplay };
}

export function readRagGovernanceEvidence() {
  const receipts = readDurableReceipts<RagGovernanceReceipt>(RECEIPT_PATH, STORE_SCHEMA_VERSION);
  const current = readCurrentState(receipts[0]?.summary.rehearsal || null);
  const latest = receipts[0] || null;
  return {
    ok: true as const,
    schemaVersion: RAG_GOVERNANCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...current,
    latest: latest?.stateDigest === current.stateDigest ? latest : null,
    latestPassing: receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    receiptPath: RECEIPT_PATH,
  };
}
