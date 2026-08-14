import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "crypto";
import type { WorkspaceDatabaseContext } from "@/features/governance/workspace-acl-database";

export const WORKSPACE_REQUEST_CONTEXT_SCHEMA_VERSION =
  "governance.workspace-request-context.v1" as const;

const MAX_CONTEXT_AGE_MS = 5 * 60_000;
const CONTEXT_HEADERS = {
  subjectId: "x-first-llm-subject-id",
  workspaceId: "x-first-llm-workspace-id",
  organizationId: "x-first-llm-organization-id",
  issuedAt: "x-first-llm-context-issued-at",
  signature: "x-first-llm-context-signature",
  requestId: "x-request-id",
} as const;

export class WorkspaceRequestContextError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403,
    readonly code: string,
  ) {
    super(message);
    this.name = "WorkspaceRequestContextError";
  }
}

function normalizeHost(hostname: string) {
  const raw = hostname.trim().toLowerCase();
  if (raw.startsWith("[")) {
    const closingBracket = raw.indexOf("]");
    if (closingBracket > 0) return raw.slice(1, closingBracket);
  }
  if (raw === "::1") return raw;
  if (raw.startsWith("::ffff:")) return raw.slice("::ffff:".length);
  return raw.replace(/:\d+$/u, "");
}

function isLoopbackHost(hostname: string) {
  const normalized = normalizeHost(hostname);
  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "127.0.0.1" ||
    normalized.startsWith("127.")
  );
}

function requireIdentifier(value: string | null, label: string) {
  const normalized = value?.trim() || "";
  if (!normalized || normalized.length > 160 || /[\u0000-\u001f]/u.test(normalized)) {
    throw new WorkspaceRequestContextError(
      `${label} is missing or invalid.`,
      400,
      "invalid_workspace_context",
    );
  }
  return normalized;
}

function signaturePayload(input: {
  subjectId: string;
  workspaceId: string;
  organizationId: string;
  issuedAt: string;
}) {
  return [
    WORKSPACE_REQUEST_CONTEXT_SCHEMA_VERSION,
    input.subjectId,
    input.workspaceId,
    input.organizationId,
    input.issuedAt,
  ].join("\n");
}

export function createWorkspaceRequestContextSignature(
  secret: string,
  input: {
    subjectId: string;
    workspaceId: string;
    organizationId: string;
    issuedAt: string;
  },
) {
  return createHmac("sha256", secret)
    .update(signaturePayload(input))
    .digest("hex");
}

function verifySignature(received: string, expected: string) {
  const left = Buffer.from(received.replace(/^sha256=/i, ""), "hex");
  const right = Buffer.from(expected, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export type ResolvedWorkspaceRequestContext = WorkspaceDatabaseContext & {
  schemaVersion: typeof WORKSPACE_REQUEST_CONTEXT_SCHEMA_VERSION;
  authMode: "loopback-local" | "signed-identity-proxy";
  issuedAt: string;
};

export function resolveWorkspaceRequestContext(
  request: Request,
  options: { now?: number } = {},
): ResolvedWorkspaceRequestContext {
  const secret = process.env.FIRST_LLM_WORKSPACE_CONTEXT_SECRET?.trim() || "";
  const url = new URL(request.url);
  const forwardedFor =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const configuredHost = process.env.FIRST_LLM_WEB_HOST || "127.0.0.1";
  const requestId =
    request.headers.get(CONTEXT_HEADERS.requestId)?.trim() || randomUUID();

  if (!secret) {
    if (
      !isLoopbackHost(configuredHost) ||
      !isLoopbackHost(url.hostname) ||
      (forwardedFor && !isLoopbackHost(forwardedFor))
    ) {
      throw new WorkspaceRequestContextError(
        "Remote workspace requests require a signed identity context.",
        401,
        "workspace_identity_required",
      );
    }
    return {
      schemaVersion: WORKSPACE_REQUEST_CONTEXT_SCHEMA_VERSION,
      authMode: "loopback-local",
      requestId,
      subjectId: process.env.FIRST_LLM_OPERATOR_ID || "local-operator",
      workspaceId: process.env.FIRST_LLM_WORKSPACE_ID || "local-workspace",
      organizationId:
        process.env.FIRST_LLM_ORGANIZATION_ID || "local-organization",
      issuedAt: new Date(options.now ?? Date.now()).toISOString(),
    };
  }

  const subjectId = requireIdentifier(
    request.headers.get(CONTEXT_HEADERS.subjectId),
    "Workspace subject",
  );
  const workspaceId = requireIdentifier(
    request.headers.get(CONTEXT_HEADERS.workspaceId),
    "Workspace id",
  );
  const organizationId = requireIdentifier(
    request.headers.get(CONTEXT_HEADERS.organizationId),
    "Organization id",
  );
  const issuedAt = requireIdentifier(
    request.headers.get(CONTEXT_HEADERS.issuedAt),
    "Workspace context timestamp",
  );
  const receivedSignature = requireIdentifier(
    request.headers.get(CONTEXT_HEADERS.signature),
    "Workspace context signature",
  );
  const issuedAtMs = Date.parse(issuedAt);
  const now = options.now ?? Date.now();
  if (!Number.isFinite(issuedAtMs) || Math.abs(now - issuedAtMs) > MAX_CONTEXT_AGE_MS) {
    throw new WorkspaceRequestContextError(
      "Workspace identity context is stale or has an invalid timestamp.",
      401,
      "stale_workspace_context",
    );
  }
  const expectedSignature = createWorkspaceRequestContextSignature(secret, {
    subjectId,
    workspaceId,
    organizationId,
    issuedAt,
  });
  if (!verifySignature(receivedSignature, expectedSignature)) {
    throw new WorkspaceRequestContextError(
      "Workspace identity context signature is invalid.",
      401,
      "invalid_workspace_signature",
    );
  }
  return {
    schemaVersion: WORKSPACE_REQUEST_CONTEXT_SCHEMA_VERSION,
    authMode: "signed-identity-proxy",
    requestId,
    subjectId,
    workspaceId,
    organizationId,
    issuedAt,
  };
}

export function readWorkspaceRequestContextReadiness() {
  const signedProxyConfigured = Boolean(
    process.env.FIRST_LLM_WORKSPACE_CONTEXT_SECRET?.trim(),
  );
  return {
    schemaVersion: WORKSPACE_REQUEST_CONTEXT_SCHEMA_VERSION,
    mode: signedProxyConfigured ? "signed-identity-proxy" : "loopback-local",
    signedProxyConfigured,
    maxContextAgeMs: MAX_CONTEXT_AGE_MS,
    trustedHeaders: Object.values(CONTEXT_HEADERS).filter(
      (header) => header !== CONTEXT_HEADERS.requestId,
    ),
  };
}
