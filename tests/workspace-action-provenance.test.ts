import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSignedWorkspaceContextHeaders,
  buildWorkspaceActionProvenance,
  WORKSPACE_ACTION_PROVENANCE_SCHEMA_VERSION,
} from "@/features/governance/workspace-action-provenance";
import { WorkspaceRequestContextError } from "@/features/governance/workspace-request-context";

const originalSecret = process.env.FIRST_LLM_WORKSPACE_CONTEXT_SECRET;
const originalHost = process.env.FIRST_LLM_WEB_HOST;

test.afterEach(() => {
  if (originalSecret === undefined) delete process.env.FIRST_LLM_WORKSPACE_CONTEXT_SECRET;
  else process.env.FIRST_LLM_WORKSPACE_CONTEXT_SECRET = originalSecret;
  if (originalHost === undefined) delete process.env.FIRST_LLM_WEB_HOST;
  else process.env.FIRST_LLM_WEB_HOST = originalHost;
});

test("workspace provenance renders current action context while durable fields remain digest-only", () => {
  delete process.env.FIRST_LLM_WORKSPACE_CONTEXT_SECRET;
  process.env.FIRST_LLM_WEB_HOST = "127.0.0.1";
  const provenance = buildWorkspaceActionProvenance(
    new Request("http://127.0.0.1:3011/api/governance/workspace-provenance"),
    { execution: "local", now: Date.parse("2026-08-21T00:00:00.000Z") },
  );

  assert.equal(WORKSPACE_ACTION_PROVENANCE_SCHEMA_VERSION, "governance.workspace-action-provenance.v1");
  assert.equal(provenance.context.authMode, "loopback-local");
  assert.equal(provenance.action.executionLocality, "local");
  assert.equal(provenance.action.dataBoundary, "loopback-local");
  assert.equal(provenance.action.sessionPersistenceBoundary, "local-snapshot-not-workspace-scoped");
  assert.ok(!JSON.stringify(provenance.audit).includes(provenance.context.subjectId));
  assert.ok(!JSON.stringify(provenance.audit).includes(provenance.context.workspaceId));
  assert.ok(!JSON.stringify(provenance.audit).includes(provenance.context.organizationId));
});

test("signed provenance rejects a tampered or stale identity context", () => {
  const secret = "workspace-provenance-test-secret";
  const now = Date.parse("2026-08-21T00:00:00.000Z");
  process.env.FIRST_LLM_WORKSPACE_CONTEXT_SECRET = secret;
  const headers = buildSignedWorkspaceContextHeaders({
    secret,
    subjectId: "alice",
    workspaceId: "workspace-a",
    organizationId: "organization-a",
    issuedAt: new Date(now).toISOString(),
    requestId: "request-a",
  });
  const request = new Request("https://studio.example/api/governance/workspace-provenance", {
    headers,
  });
  assert.equal(
    buildWorkspaceActionProvenance(request, { execution: "remote", now }).context.authMode,
    "signed-identity-proxy",
  );
  assert.throws(
    () =>
      buildWorkspaceActionProvenance(
        new Request("https://studio.example/api/governance/workspace-provenance", {
          headers: { ...headers, "x-first-llm-context-signature": "00".repeat(32) },
        }),
        { now },
      ),
    (error: unknown) => error instanceof WorkspaceRequestContextError && error.code === "invalid_workspace_signature",
  );
  assert.throws(
    () => buildWorkspaceActionProvenance(request, { now: now + 10 * 60_000 }),
    (error: unknown) => error instanceof WorkspaceRequestContextError && error.code === "stale_workspace_context",
  );
});
