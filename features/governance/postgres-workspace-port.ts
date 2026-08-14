import type { WorkspaceDatabaseContext } from "@/features/governance/workspace-acl-database";
import { buildPostgresRequestContext } from "@/features/governance/postgres-request-context";

export const POSTGRES_WORKSPACE_PORT_SCHEMA_VERSION =
  "governance.postgres-workspace-port.v1" as const;

export function buildPostgresWorkspaceResourcePlan(
  context: WorkspaceDatabaseContext,
  input: {
    operation: "list" | "create" | "audit";
    resourceId?: string;
    kind?: string;
    label?: string;
  },
) {
  const requestContext = buildPostgresRequestContext(context);
  if (input.operation === "list") {
    return {
      schemaVersion: POSTGRES_WORKSPACE_PORT_SCHEMA_VERSION,
      transactionRequired: true,
      context: requestContext,
      statement: `
        SELECT id, workspace_id AS "workspaceId", kind, label
        FROM first_llm.workspace_resources
        WHERE workspace_id = $1
          AND ($2::text IS NULL OR kind = $2)
        ORDER BY kind, label, id
      `.trim(),
      parameters: [context.workspaceId, input.kind || null],
    };
  }
  if (input.operation === "create") {
    if (!input.resourceId?.trim() || !input.kind?.trim() || !input.label?.trim()) {
      throw new Error("Postgres workspace resource create requires id, kind, and label.");
    }
    return {
      schemaVersion: POSTGRES_WORKSPACE_PORT_SCHEMA_VERSION,
      transactionRequired: true,
      context: requestContext,
      statement: `
        INSERT INTO first_llm.workspace_resources(id, workspace_id, kind, label)
        VALUES ($1, $2, $3, $4)
        RETURNING id, workspace_id AS "workspaceId", kind, label
      `.trim(),
      parameters: [
        input.resourceId,
        context.workspaceId,
        input.kind,
        input.label,
      ],
    };
  }
  return {
    schemaVersion: POSTGRES_WORKSPACE_PORT_SCHEMA_VERSION,
    transactionRequired: true,
    context: requestContext,
    statement:
      "SELECT first_llm.record_workspace_audit($1, $2, $3, $4, $5, $6, $7, $8)",
    parameters: [
      `workspace-audit-${context.requestId}`,
      context.requestId,
      context.workspaceId,
      "workspace.resource",
      input.resourceId || null,
      input.kind || null,
      "allowed",
      "Application workspace port authorized the operation.",
    ],
  };
}
