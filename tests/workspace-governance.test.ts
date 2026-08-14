import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createAuthorizedWorkspaceResource,
  listAuthorizedWorkspaceResources,
  readWorkspaceAuditEvents,
  runWorkspaceIsolationRehearsal,
  runWorkspaceMultiUserConflictRehearsal,
  updateAuthorizedWorkspaceResource,
  WorkspaceDatabaseAuthorizationError,
  type WorkspaceDatabaseContext,
} from "@/features/governance/workspace-acl-database";
import { buildPostgresWorkspaceResourcePlan } from "@/features/governance/postgres-workspace-port";
import {
  createWorkspaceRequestContextSignature,
  resolveWorkspaceRequestContext,
  WorkspaceRequestContextError,
} from "@/features/governance/workspace-request-context";
import { runIdentityWorkspaceMappingRehearsal } from "@/features/governance/identity-workspace-mapping";

const originalSecret = process.env.FIRST_LLM_WORKSPACE_CONTEXT_SECRET;
const originalHost = process.env.FIRST_LLM_WEB_HOST;

test.afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.FIRST_LLM_WORKSPACE_CONTEXT_SECRET;
  } else {
    process.env.FIRST_LLM_WORKSPACE_CONTEXT_SECRET = originalSecret;
  }
  if (originalHost === undefined) delete process.env.FIRST_LLM_WEB_HOST;
  else process.env.FIRST_LLM_WEB_HOST = originalHost;
});

test("loopback requests receive only the local workspace context", () => {
  delete process.env.FIRST_LLM_WORKSPACE_CONTEXT_SECRET;
  process.env.FIRST_LLM_WEB_HOST = "127.0.0.1";
  const context = resolveWorkspaceRequestContext(
    new Request("http://127.0.0.1:3011/api/governance/workspaces/resources"),
  );
  assert.equal(context.authMode, "loopback-local");
  assert.equal(context.workspaceId, "local-workspace");
  assert.equal(
    resolveWorkspaceRequestContext(
      new Request("http://127.0.0.1:3011/api/governance/workspaces/resources", {
        headers: { "x-forwarded-for": "::ffff:127.0.0.1" },
      }),
    ).authMode,
    "loopback-local",
  );
  assert.throws(
    () =>
      resolveWorkspaceRequestContext(
        new Request("http://127.0.0.1:3011/api/governance/workspaces/resources", {
          headers: { "x-forwarded-for": "203.0.113.9" },
        }),
      ),
    WorkspaceRequestContextError,
  );
});

test("signed identity context validates tenant headers and freshness", () => {
  const secret = "workspace-context-test-secret";
  const now = Date.parse("2026-07-23T08:00:00.000Z");
  const identity = {
    subjectId: "alice",
    workspaceId: "workspace-a",
    organizationId: "organization-a",
    issuedAt: new Date(now).toISOString(),
  };
  process.env.FIRST_LLM_WORKSPACE_CONTEXT_SECRET = secret;
  const signature = createWorkspaceRequestContextSignature(secret, identity);
  const request = new Request("https://studio.example/api/governance/workspaces/resources", {
    headers: {
      "x-first-llm-subject-id": identity.subjectId,
      "x-first-llm-workspace-id": identity.workspaceId,
      "x-first-llm-organization-id": identity.organizationId,
      "x-first-llm-context-issued-at": identity.issuedAt,
      "x-first-llm-context-signature": signature,
    },
  });
  assert.equal(
    resolveWorkspaceRequestContext(request, { now }).authMode,
    "signed-identity-proxy",
  );
  assert.throws(
    () => resolveWorkspaceRequestContext(request, { now: now + 10 * 60_000 }),
    (error: unknown) =>
      error instanceof WorkspaceRequestContextError &&
      error.code === "stale_workspace_context",
  );
});

test("database resource port scopes writes, reads, and immutable audit", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "first-llm-governance-"));
  const databasePath = path.join(directory, "workspace.sqlite");
  const context: WorkspaceDatabaseContext = {
    requestId: "request-local-create",
    subjectId: "local-operator",
    workspaceId: "local-workspace",
    organizationId: "local-organization",
  };
  try {
    const created = createAuthorizedWorkspaceResource(
      context,
      { id: "dataset-local", kind: "dataset", label: "Local dataset" },
      { databasePath },
    );
    assert.equal(created.workspaceId, context.workspaceId);
    assert.ok(
      listAuthorizedWorkspaceResources(context, { databasePath }).some(
        (resource) => resource.id === created.id,
      ),
    );
    assert.ok(
      readWorkspaceAuditEvents(context, { databasePath }).some(
        (event) => event.requestId === context.requestId,
      ),
    );
    assert.throws(
      () =>
        listAuthorizedWorkspaceResources(
          { ...context, organizationId: "other-organization" },
          { databasePath },
        ),
      WorkspaceDatabaseAuthorizationError,
    );
    assert.throws(
      () =>
        updateAuthorizedWorkspaceResource(
          { ...context, organizationId: "other-organization" },
          {
            resourceId: created.id,
            label: "Cross-organization overwrite",
            expectedRevision: created.revision,
          },
          { databasePath },
        ),
      WorkspaceDatabaseAuthorizationError,
    );
    assert.equal(runWorkspaceIsolationRehearsal().ok, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Postgres workspace port keeps context and values parameterized", () => {
  const context: WorkspaceDatabaseContext = {
    requestId: "request-plan",
    subjectId: "alice",
    workspaceId: "workspace-a",
    organizationId: "organization-a",
  };
  const plan = buildPostgresWorkspaceResourcePlan(context, {
    operation: "create",
    resourceId: "resource-a",
    kind: "workflow",
    label: "Workflow A",
  });
  assert.equal(plan.transactionRequired, true);
  assert.deepEqual(plan.context.parameters, ["alice", "workspace-a"]);
  assert.match(plan.statement, /VALUES \(\$1, \$2, \$3, \$4\)/u);
  assert.ok(!plan.statement.includes("resource-a"));
});

test("SCIM groups map OIDC subjects only into the bound organization workspace", () => {
  const rehearsal = runIdentityWorkspaceMappingRehearsal();
  assert.equal(rehearsal.ok, true);
  assert.deepEqual(rehearsal.checks, {
    activeScimMemberMaterialized: true,
    oidcSubjectAndGroupResolved: true,
    missingGroupClaimDenied: true,
    inactiveScimUserDenied: true,
    crossOrganizationRejected: true,
  });
});

test("multi-user stale writes return an auditable optimistic conflict", () => {
  const rehearsal = runWorkspaceMultiUserConflictRehearsal();
  assert.equal(rehearsal.ok, true);
  assert.equal(rehearsal.conflict?.status, 409);
  assert.equal(rehearsal.conflict?.expectedRevision, 1);
  assert.equal(rehearsal.conflict?.actualRevision, 2);
  assert.equal(rehearsal.winner?.label, "Shared workflow v2");
});
