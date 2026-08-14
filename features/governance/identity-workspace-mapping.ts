import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { readScimDirectorySnapshot } from "@/features/governance/identity-provisioning";
import {
  readWorkspaceAclDatabase,
  replaceWorkspaceDirectoryGroupMapping,
  resolveWorkspaceAssignmentsForOidcIdentity,
  type WorkspaceRole,
} from "@/features/governance/workspace-acl-database";

export const IDENTITY_WORKSPACE_MAPPING_SCHEMA_VERSION =
  "governance.identity-workspace-mapping.v1" as const;

export function applyScimGroupWorkspaceMapping(input: {
  scimGroupId: string;
  organizationId: string;
  workspaceId: string;
  role: WorkspaceRole;
}) {
  const directory = readScimDirectorySnapshot();
  const group = directory.groups.find((entry) => entry.id === input.scimGroupId);
  if (!group) throw new Error("SCIM group was not found for workspace mapping.");
  const usersById = new Map(directory.users.map((user) => [user.id, user]));
  return replaceWorkspaceDirectoryGroupMapping({
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    externalGroupId: group.id,
    groupLabel: group.displayName,
    role: input.role,
    members: group.members
      .map((member) => usersById.get(member.value))
      .filter((user): user is NonNullable<typeof user> => Boolean(user))
      .map((user) => ({
        subjectId: user.externalId?.trim() || user.id,
        label: user.displayName || user.userName,
        active: user.active,
      })),
  });
}

export function resolveOidcIdentityWorkspaceMappings(identity: {
  subject: string;
  groups: string[];
}) {
  return resolveWorkspaceAssignmentsForOidcIdentity({
    subjectId: identity.subject,
    groupClaims: identity.groups,
  });
}

export function readIdentityWorkspaceMappingReadiness() {
  const database = readWorkspaceAclDatabase();
  return {
    ok: true as const,
    schemaVersion: IDENTITY_WORKSPACE_MAPPING_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    mappingCounts: {
      groups: database.counts.directoryGroups,
      groupMembers: database.counts.directoryGroupMembers,
      workspaceRoleMappings: database.counts.groupWorkspaceMappings,
    },
    enforcement: {
      organizationWorkspaceMatch: true,
      explicitGroupClaimRequired: true,
      inactiveScimUsersExcluded: true,
      oidcSubjectUsesScimExternalId: true,
    },
  };
}

export function runIdentityWorkspaceMappingRehearsal() {
  const directory = mkdtempSync(
    path.join(os.tmpdir(), "first-llm-identity-mapping-"),
  );
  const databasePath = path.join(directory, "workspace.sqlite");
  try {
    const mapping = replaceWorkspaceDirectoryGroupMapping(
      {
        organizationId: "local-organization",
        workspaceId: "local-workspace",
        externalGroupId: "engineering",
        groupLabel: "Engineering",
        role: "builder",
        members: [
          { subjectId: "oidc-alice", label: "Alice", active: true },
          { subjectId: "oidc-disabled", label: "Disabled user", active: false },
        ],
      },
      { databasePath },
    );
    const assignments = resolveWorkspaceAssignmentsForOidcIdentity(
      { subjectId: "oidc-alice", groupClaims: ["engineering"] },
      { databasePath },
    );
    const wrongClaimAssignments = resolveWorkspaceAssignmentsForOidcIdentity(
      { subjectId: "oidc-alice", groupClaims: ["finance"] },
      { databasePath },
    );
    const inactiveAssignments = resolveWorkspaceAssignmentsForOidcIdentity(
      { subjectId: "oidc-disabled", groupClaims: ["engineering"] },
      { databasePath },
    );
    let crossOrganizationRejected = false;
    try {
      replaceWorkspaceDirectoryGroupMapping(
        {
          organizationId: "other-organization",
          workspaceId: "local-workspace",
          externalGroupId: "engineering",
          groupLabel: "Engineering",
          role: "builder",
          members: [],
        },
        { databasePath },
      );
    } catch {
      crossOrganizationRejected = true;
    }
    const checks = {
      activeScimMemberMaterialized: mapping.activeMemberCount === 1,
      oidcSubjectAndGroupResolved:
        assignments.length === 1 &&
        assignments[0]?.workspaceId === "local-workspace" &&
        assignments[0]?.organizationId === "local-organization" &&
        assignments[0]?.role === "builder",
      missingGroupClaimDenied: wrongClaimAssignments.length === 0,
      inactiveScimUserDenied: inactiveAssignments.length === 0,
      crossOrganizationRejected,
    };
    return {
      ok: Object.values(checks).every(Boolean),
      schemaVersion: IDENTITY_WORKSPACE_MAPPING_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      checks,
      mapping,
      assignments,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
