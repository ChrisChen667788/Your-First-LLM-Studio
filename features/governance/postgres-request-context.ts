export const POSTGRES_REQUEST_CONTEXT_SCHEMA_VERSION = "governance.postgres-request-context.v1" as const;

export function buildPostgresRequestContext(input: { subjectId?: string; workspaceId?: string }) {
  const subjectId = input.subjectId?.trim(); const workspaceId = input.workspaceId?.trim();
  if (!subjectId || !workspaceId) throw new Error("subjectId and workspaceId are required.");
  return {
    schemaVersion: POSTGRES_REQUEST_CONTEXT_SCHEMA_VERSION,
    statement: "SELECT first_llm.set_request_context($1, $2)",
    parameters: [subjectId, workspaceId],
    transactionRequired: true,
    resetPolicy: "transaction-local-set-config",
  };
}
