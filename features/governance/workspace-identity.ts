export const WORKSPACE_IDENTITY_SCHEMA_VERSION = "governance.workspace-identity.v1" as const;

export type WorkspaceRole = "owner" | "admin" | "builder" | "viewer";
export type WorkspaceResource = "model" | "profile" | "knowledge" | "dataset" | "adapter" | "workflow" | "benchmark";
export type WorkspaceAction = "read" | "write" | "execute" | "admin";

export type WorkspaceMembership = {
  subjectId: string;
  workspaceId: string;
  role: WorkspaceRole;
};

const ROLE_ACTIONS: Record<WorkspaceRole, WorkspaceAction[]> = {
  owner: ["read", "write", "execute", "admin"],
  admin: ["read", "write", "execute", "admin"],
  builder: ["read", "write", "execute"],
  viewer: ["read"],
};

export function decideWorkspaceAccess(input: {
  membership?: WorkspaceMembership;
  workspaceId: string;
  resource: WorkspaceResource;
  action: WorkspaceAction;
}) {
  const membership = input.membership;
  const allowed = Boolean(
    membership &&
      membership.workspaceId === input.workspaceId &&
      ROLE_ACTIONS[membership.role].includes(input.action),
  );
  return {
    allowed,
    reason: allowed
      ? `${membership?.role} may ${input.action} ${input.resource}.`
      : "No matching workspace membership grants this action.",
  };
}

export function readWorkspaceIdentityFoundation() {
  const enabled = process.env.ENABLE_TEAM_GOVERNANCE === "1";
  const localMembership: WorkspaceMembership = {
    subjectId: process.env.FIRST_LLM_OPERATOR_ID || "local-operator",
    workspaceId: "local-workspace",
    role: "owner",
  };
  return {
    ok: true as const,
    schemaVersion: WORKSPACE_IDENTITY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    mode: enabled ? "local-preview" as const : "preview-disabled" as const,
    organization: { id: "local-organization", label: "Local organization" },
    workspaces: [{ id: "local-workspace", label: "Local workspace", organizationId: "local-organization" }],
    memberships: [localMembership],
    sampleDecision: decideWorkspaceAccess({
      membership: localMembership,
      workspaceId: "local-workspace",
      resource: "workflow",
      action: "execute",
    }),
    enforcementLayers: ["application-action", "storage-query", "artifact-access", "audit-event"],
    blockers: [
      ...(enabled ? [] : ["Team governance preview flag is disabled."]),
      "OIDC/SSO, SCIM, production Postgres RLS, and external secret-vault evidence are not configured.",
    ],
  };
}
