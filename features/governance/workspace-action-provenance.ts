import { createHash, randomUUID } from "node:crypto";

import {
  createWorkspaceRequestContextSignature,
  resolveWorkspaceRequestContext,
  WORKSPACE_REQUEST_CONTEXT_SCHEMA_VERSION,
  type ResolvedWorkspaceRequestContext,
} from "@/features/governance/workspace-request-context";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export const WORKSPACE_ACTION_PROVENANCE_SCHEMA_VERSION =
  "governance.workspace-action-provenance.v1" as const;

const STORE_SCHEMA_VERSION =
  "governance.workspace-action-provenance-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath(
  "governance",
  "workspace-action-provenance.json",
);

type ExecutionLocality = "local" | "remote";

export type WorkspaceActionProvenance = {
  ok: true;
  schemaVersion: typeof WORKSPACE_ACTION_PROVENANCE_SCHEMA_VERSION;
  generatedAt: string;
  context: ResolvedWorkspaceRequestContext;
  action: {
    executionLocality: ExecutionLocality;
    dataBoundary: "loopback-local" | "signed-identity-proxy";
    sessionPersistenceBoundary: "local-snapshot-not-workspace-scoped";
  };
  audit: {
    requestIdDigest: string;
    subjectDigest: string;
    workspaceDigest: string;
    organizationDigest: string;
    contextDigest: string;
  };
};

export type WorkspaceActionProvenanceReceipt = {
  id: string;
  generatedAt: string;
  status: "pass";
  authMode: ResolvedWorkspaceRequestContext["authMode"];
  executionLocality: ExecutionLocality;
  dataBoundary: WorkspaceActionProvenance["action"]["dataBoundary"];
  contextAgeMs: number;
  expiresAt: string;
  audit: WorkspaceActionProvenance["audit"];
  disclosure: string;
  receiptDigest: string;
};

function stableDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function executionLocality(value: string | null | undefined): ExecutionLocality {
  return value === "remote" ? "remote" : "local";
}

function buildAudit(context: ResolvedWorkspaceRequestContext) {
  return {
    requestIdDigest: stableDigest(context.requestId),
    subjectDigest: stableDigest(context.subjectId),
    workspaceDigest: stableDigest(context.workspaceId),
    organizationDigest: stableDigest(context.organizationId),
    contextDigest: stableDigest({
      schemaVersion: context.schemaVersion,
      authMode: context.authMode,
      requestId: context.requestId,
      subjectId: context.subjectId,
      workspaceId: context.workspaceId,
      organizationId: context.organizationId,
      issuedAt: context.issuedAt,
    }),
  };
}

export function buildWorkspaceActionProvenance(
  request: Request,
  options: { execution?: string | null; now?: number } = {},
): WorkspaceActionProvenance {
  const context = resolveWorkspaceRequestContext(request, { now: options.now });
  return {
    ok: true,
    schemaVersion: WORKSPACE_ACTION_PROVENANCE_SCHEMA_VERSION,
    generatedAt: new Date(options.now ?? Date.now()).toISOString(),
    context,
    action: {
      executionLocality: executionLocality(options.execution),
      dataBoundary:
        context.authMode === "signed-identity-proxy"
          ? "signed-identity-proxy"
          : "loopback-local",
      sessionPersistenceBoundary: "local-snapshot-not-workspace-scoped",
    },
    audit: buildAudit(context),
  };
}

export function recordWorkspaceActionProvenance(
  request: Request,
  options: { execution?: string | null; now?: number } = {},
) {
  const provenance = buildWorkspaceActionProvenance(request, options);
  const generatedAt = provenance.generatedAt;
  const contextAgeMs = Math.max(0, (options.now ?? Date.now()) - Date.parse(provenance.context.issuedAt));
  const expiresAt = new Date(Date.parse(provenance.context.issuedAt) + 5 * 60_000).toISOString();
  const withoutDigest = {
    id: `workspace-provenance-${randomUUID()}`,
    generatedAt,
    status: "pass" as const,
    authMode: provenance.context.authMode,
    executionLocality: provenance.action.executionLocality,
    dataBoundary: provenance.action.dataBoundary,
    contextAgeMs,
    expiresAt,
    audit: provenance.audit,
    disclosure:
      "The durable receipt contains digests only; subject, workspace, organization, and request identifiers are not persisted here.",
  };
  const receipt: WorkspaceActionProvenanceReceipt = {
    ...withoutDigest,
    receiptDigest: stableDigest(withoutDigest),
  };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 100);
  return { provenance, receipt };
}

export function readWorkspaceActionProvenanceEvidence() {
  const receipts = readDurableReceipts<WorkspaceActionProvenanceReceipt>(
    RECEIPT_PATH,
    STORE_SCHEMA_VERSION,
  );
  const latest = receipts[0] || null;
  return {
    ok: true as const,
    schemaVersion: WORKSPACE_ACTION_PROVENANCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localStatus: latest?.status === "pass" ? ("pass" as const) : ("hold" as const),
    productionStatus: "hold" as const,
    latest,
    latestPassing: receipts.find((receipt) => receipt.status === "pass") || null,
    receipts,
    receiptPath: RECEIPT_PATH,
    blockers: [
      ...(latest
        ? []
        : ["No workspace action provenance receipt has been recorded by a trusted operator."]),
      "Agent session snapshots are local and are not yet workspace-scoped persistence.",
      "OIDC/JWKS, SCIM lifecycle, non-loopback traffic, and organization-owned identity acceptance remain external HOLD gates.",
    ],
  };
}

export function buildSignedWorkspaceContextHeaders(input: {
  secret: string;
  subjectId: string;
  workspaceId: string;
  organizationId: string;
  issuedAt: string;
  requestId?: string;
}) {
  const signature = createWorkspaceRequestContextSignature(input.secret, input);
  return {
    "x-first-llm-subject-id": input.subjectId,
    "x-first-llm-workspace-id": input.workspaceId,
    "x-first-llm-organization-id": input.organizationId,
    "x-first-llm-context-issued-at": input.issuedAt,
    "x-first-llm-context-signature": signature,
    ...(input.requestId ? { "x-request-id": input.requestId } : {}),
    "x-first-llm-context-contract": WORKSPACE_REQUEST_CONTEXT_SCHEMA_VERSION,
  };
}
