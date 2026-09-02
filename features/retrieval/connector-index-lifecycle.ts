import { createHash } from "node:crypto";

export const CONNECTOR_INDEX_LIFECYCLE_SCHEMA_VERSION =
  "retrieval.connector-index-lifecycle.v1" as const;

export type CorpusRevision = {
  id: string;
  parentId: string | null;
  connectorId: string;
  parserVersion: string;
  documentIds: string[];
  deletedDocumentIds: string[];
  indexVersion: string;
  state: "staged" | "active" | "rolled-back";
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function evaluateConnectorIndexLifecycle(input: {
  revisions: CorpusRevision[];
  activeRevisionId: string;
  indexedDocumentIds: string[];
}) {
  const active = input.revisions.find((revision) => revision.id === input.activeRevisionId) || null;
  const revisionIds = new Set(input.revisions.map((revision) => revision.id));
  const checks = {
    activeRevisionExists: Boolean(active && active.state === "active"),
    parentChainResolvable: input.revisions.every(
      (revision) => revision.parentId === null || revisionIds.has(revision.parentId),
    ),
    parserVersionPinned: input.revisions.every((revision) => Boolean(revision.parserVersion.trim())),
    indexVersionPinned: input.revisions.every((revision) => Boolean(revision.indexVersion.trim())),
    deletionsPropagated:
      Boolean(active) &&
      active!.deletedDocumentIds.every((documentId) => !input.indexedDocumentIds.includes(documentId)),
    activeDocumentsIndexed:
      Boolean(active) &&
      active!.documentIds.every((documentId) => input.indexedDocumentIds.includes(documentId)),
    rollbackAvailable: Boolean(active?.parentId && revisionIds.has(active.parentId)),
  };
  const withoutDigest = {
    activeRevisionId: input.activeRevisionId,
    checks,
    status: Object.values(checks).every(Boolean) ? "pass" as const : "hold" as const,
  };
  return { ...withoutDigest, lifecycleDigest: digest(withoutDigest) };
}

export function readConnectorIndexLifecycleEvidence() {
  const lifecycle = evaluateConnectorIndexLifecycle({
    activeRevisionId: "corpus-r2",
    indexedDocumentIds: ["doc-a", "doc-c"],
    revisions: [
      { id: "corpus-r1", parentId: null, connectorId: "fixture", parserVersion: "parser-1", documentIds: ["doc-a", "doc-b"], deletedDocumentIds: [], indexVersion: "hybrid-1", state: "staged" },
      { id: "corpus-r2", parentId: "corpus-r1", connectorId: "fixture", parserVersion: "parser-2", documentIds: ["doc-a", "doc-c"], deletedDocumentIds: ["doc-b"], indexVersion: "hybrid-2", state: "active" },
    ],
  });
  return {
    ok: true as const,
    schemaVersion: CONNECTOR_INDEX_LIFECYCLE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sourceStatus: lifecycle.status,
    localStatus: lifecycle.status,
    productionStatus: "hold" as const,
    lifecycle,
    disclosure:
      "The reference corpus proves revision, parser/index pinning, deletion propagation and rollback semantics. Managed connector credentials and deployed-index reconciliation remain external evidence.",
  };
}
