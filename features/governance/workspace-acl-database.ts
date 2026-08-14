import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { randomUUID } from "crypto";
import { createRequire } from "module";
import os from "os";
import path from "path";

export const WORKSPACE_ACL_DATABASE_SCHEMA_VERSION =
  "governance.workspace-acl-database.v4" as const;

type SqliteStatement = {
  run: (...params: Array<string | number | null>) => { changes: number | bigint };
  get: (...params: Array<string | number | null>) => Record<string, unknown> | undefined;
  all: (...params: Array<string | number | null>) => Array<Record<string, unknown>>;
};

type SqliteDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
  close: () => void;
};

type DatabaseConstructor = new (filePath: string) => SqliteDatabase;

const runtimeRequire = createRequire(import.meta.url);
const { DatabaseSync } = runtimeRequire("node:sqlite") as { DatabaseSync: DatabaseConstructor };

const DATA_DIR =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const GOVERNANCE_DIR = path.join(DATA_DIR, "governance");
const DATABASE_FILE = path.join(GOVERNANCE_DIR, "workspace-acl.sqlite");

const MIGRATIONS = [
  {
    version: 1,
    name: "workspace_acl_foundation",
    sql: `
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        label TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK(kind IN ('user', 'service-account')),
        label TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memberships (
        subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'builder', 'viewer')),
        PRIMARY KEY(subject_id, workspace_id)
      );
      CREATE TABLE IF NOT EXISTS role_permissions (
        role TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('read', 'write', 'execute', 'admin')),
        PRIMARY KEY(role, action)
      );
      CREATE TABLE IF NOT EXISTS workspace_resources (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        label TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_workspace_resources_workspace
        ON workspace_resources(workspace_id, kind);
      CREATE INDEX IF NOT EXISTS idx_memberships_workspace_subject
        ON memberships(workspace_id, subject_id);
    `,
  },
  {
    version: 2,
    name: "immutable_workspace_audit",
    sql: `
      CREATE TABLE IF NOT EXISTS workspace_audit_events (
        id TEXT PRIMARY KEY,
        occurred_at TEXT NOT NULL,
        request_id TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        action TEXT NOT NULL,
        resource_id TEXT,
        resource_kind TEXT,
        outcome TEXT NOT NULL CHECK(outcome IN ('allowed', 'denied')),
        reason TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_workspace_audit_workspace_time
        ON workspace_audit_events(workspace_id, occurred_at DESC);
      CREATE TRIGGER IF NOT EXISTS workspace_audit_no_update
        BEFORE UPDATE ON workspace_audit_events
        BEGIN
          SELECT RAISE(ABORT, 'workspace audit events are immutable');
        END;
      CREATE TRIGGER IF NOT EXISTS workspace_audit_no_delete
        BEFORE DELETE ON workspace_audit_events
        BEGIN
          SELECT RAISE(ABORT, 'workspace audit events are immutable');
        END;
    `,
  },
  {
    version: 3,
    name: "organization_group_workspace_mapping",
    sql: `
      CREATE TABLE IF NOT EXISTS directory_groups (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        external_id TEXT NOT NULL,
        label TEXT NOT NULL,
        UNIQUE(organization_id, external_id)
      );
      CREATE TABLE IF NOT EXISTS directory_group_members (
        group_id TEXT NOT NULL REFERENCES directory_groups(id) ON DELETE CASCADE,
        subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        PRIMARY KEY(group_id, subject_id)
      );
      CREATE TABLE IF NOT EXISTS group_workspace_role_mappings (
        group_id TEXT NOT NULL REFERENCES directory_groups(id) ON DELETE CASCADE,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'builder', 'viewer')),
        PRIMARY KEY(group_id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_directory_groups_organization_external
        ON directory_groups(organization_id, external_id);
      CREATE INDEX IF NOT EXISTS idx_group_members_subject
        ON directory_group_members(subject_id, group_id);
    `,
  },
  {
    version: 4,
    name: "workspace_resource_optimistic_concurrency",
    sql: `
      ALTER TABLE workspace_resources
        ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE workspace_resources
        ADD COLUMN updated_at TEXT;
      ALTER TABLE workspace_resources
        ADD COLUMN updated_by TEXT;
    `,
  },
] as const;

export type WorkspaceDatabaseContext = {
  requestId: string;
  subjectId: string;
  workspaceId: string;
  organizationId: string;
};

export type WorkspaceRole = "owner" | "admin" | "builder" | "viewer";

export type WorkspaceDatabaseResource = {
  id: string;
  workspaceId: string;
  kind: string;
  label: string;
  role: string;
  revision: number;
  updatedAt?: string | null;
  updatedBy?: string | null;
};

export class WorkspaceDatabaseAuthorizationError extends Error {
  readonly status = 403;

  constructor(message = "Workspace membership does not grant this action.") {
    super(message);
    this.name = "WorkspaceDatabaseAuthorizationError";
  }
}

export class WorkspaceDatabaseConflictError extends Error {
  readonly status = 409;
  readonly code = "workspace_resource_revision_conflict";

  constructor(
    readonly expectedRevision: number,
    readonly actualRevision: number,
  ) {
    super(
      `Workspace resource revision changed from ${expectedRevision} to ${actualRevision}.`,
    );
    this.name = "WorkspaceDatabaseConflictError";
  }
}

function openDatabase(filePath = DATABASE_FILE) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const database = new DatabaseSync(filePath);
  database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  for (const migration of MIGRATIONS) {
    const applied = database.prepare("SELECT version FROM schema_migrations WHERE version = ?").get(migration.version);
    if (applied) continue;
    database.exec("BEGIN IMMEDIATE;");
    try {
      database.exec(migration.sql);
      database.prepare("INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)")
        .run(migration.version, migration.name, new Date().toISOString());
      database.exec("COMMIT;");
    } catch (error) {
      database.exec("ROLLBACK;");
      database.close();
      throw error;
    }
  }
  return database;
}

function seedLocalWorkspace(database: SqliteDatabase) {
  database.prepare("INSERT OR IGNORE INTO organizations(id, label) VALUES (?, ?)").run("local-organization", "Local organization");
  database.prepare("INSERT OR IGNORE INTO workspaces(id, organization_id, label) VALUES (?, ?, ?)")
    .run("local-workspace", "local-organization", "Local workspace");
  database.prepare("INSERT OR IGNORE INTO subjects(id, kind, label) VALUES (?, ?, ?)")
    .run("local-operator", "user", "Local operator");
  database.prepare("INSERT OR IGNORE INTO memberships(subject_id, workspace_id, role) VALUES (?, ?, ?)")
    .run("local-operator", "local-workspace", "owner");
  for (const [role, actions] of Object.entries({
    owner: ["read", "write", "execute", "admin"],
    admin: ["read", "write", "execute", "admin"],
    builder: ["read", "write", "execute"],
    viewer: ["read"],
  })) {
    for (const action of actions) {
      database.prepare("INSERT OR IGNORE INTO role_permissions(role, action) VALUES (?, ?)").run(role, action);
    }
  }
  database.prepare("INSERT OR IGNORE INTO workspace_resources(id, workspace_id, kind, label) VALUES (?, ?, ?, ?)")
    .run("local-workflow", "local-workspace", "workflow", "Local protected-tool workflow");
}

function queryAuthorizedResource(database: SqliteDatabase, input: {
  subjectId: string;
  workspaceId: string;
  resourceId: string;
  action: "read" | "write" | "execute" | "admin";
}) {
  return database.prepare(`
    SELECT r.id, r.workspace_id AS workspaceId, r.kind, r.label, m.role,
      r.revision, r.updated_at AS updatedAt, r.updated_by AS updatedBy
    FROM workspace_resources r
    JOIN memberships m
      ON m.workspace_id = r.workspace_id
     AND m.subject_id = ?
    JOIN role_permissions p
      ON p.role = m.role
     AND p.action = ?
    WHERE r.id = ?
      AND r.workspace_id = ?
    LIMIT 1
  `).get(input.subjectId, input.action, input.resourceId, input.workspaceId);
}

function hasWorkspacePermission(
  database: SqliteDatabase,
  input: WorkspaceDatabaseContext & {
    action: "read" | "write" | "execute" | "admin";
  },
) {
  return Boolean(
    database.prepare(`
      SELECT 1
      FROM workspaces w
      JOIN memberships m
        ON m.workspace_id = w.id
       AND m.subject_id = ?
      JOIN role_permissions p
        ON p.role = m.role
       AND p.action = ?
      WHERE w.id = ?
        AND w.organization_id = ?
      LIMIT 1
    `).get(
      input.subjectId,
      input.action,
      input.workspaceId,
      input.organizationId,
    ),
  );
}

function appendWorkspaceAuditEvent(
  database: SqliteDatabase,
  input: WorkspaceDatabaseContext & {
    action: string;
    resourceId?: string | null;
    resourceKind?: string | null;
    outcome: "allowed" | "denied";
    reason: string;
  },
) {
  database.prepare(`
    INSERT INTO workspace_audit_events(
      id, occurred_at, request_id, subject_id, workspace_id, action,
      resource_id, resource_kind, outcome, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `workspace-audit-${randomUUID()}`,
    new Date().toISOString(),
    input.requestId,
    input.subjectId,
    input.workspaceId,
    input.action,
    input.resourceId || null,
    input.resourceKind || null,
    input.outcome,
    input.reason,
  );
}

function openSeededDatabase(filePath = DATABASE_FILE) {
  const database = openDatabase(filePath);
  seedLocalWorkspace(database);
  return database;
}

export function listAuthorizedWorkspaceResources(
  context: WorkspaceDatabaseContext,
  options: { kind?: string; databasePath?: string } = {},
) {
  const database = openSeededDatabase(options.databasePath);
  try {
    const allowed = hasWorkspacePermission(database, {
      ...context,
      action: "read",
    });
    appendWorkspaceAuditEvent(database, {
      ...context,
      action: "resource.list",
      resourceKind: options.kind || null,
      outcome: allowed ? "allowed" : "denied",
      reason: allowed
        ? "Database membership grants workspace resource read."
        : "No organization-scoped workspace membership grants resource read.",
    });
    if (!allowed) throw new WorkspaceDatabaseAuthorizationError();
    const params: Array<string | number | null> = [
      context.subjectId,
      context.workspaceId,
      context.organizationId,
    ];
    const kindClause = options.kind ? "AND r.kind = ?" : "";
    if (options.kind) params.push(options.kind);
    return database.prepare(`
      SELECT r.id, r.workspace_id AS workspaceId, r.kind, r.label, m.role,
        r.revision, r.updated_at AS updatedAt, r.updated_by AS updatedBy
      FROM workspace_resources r
      JOIN workspaces w
        ON w.id = r.workspace_id
       AND w.organization_id = ?3
      JOIN memberships m
        ON m.workspace_id = r.workspace_id
       AND m.subject_id = ?1
      JOIN role_permissions p
        ON p.role = m.role
       AND p.action = 'read'
      WHERE r.workspace_id = ?2
        ${kindClause}
      ORDER BY r.kind, r.label, r.id
    `).all(...params) as WorkspaceDatabaseResource[];
  } finally {
    database.close();
  }
}

export function createAuthorizedWorkspaceResource(
  context: WorkspaceDatabaseContext,
  input: { id?: string; kind: string; label: string },
  options: { databasePath?: string } = {},
) {
  const kind = input.kind.trim();
  const label = input.label.trim();
  const id = input.id?.trim() || `workspace-resource-${randomUUID()}`;
  if (!kind || !label) {
    throw new Error("Workspace resource kind and label are required.");
  }
  const database = openSeededDatabase(options.databasePath);
  let transactionOpen = false;
  try {
    database.exec("BEGIN IMMEDIATE;");
    transactionOpen = true;
    const allowed = hasWorkspacePermission(database, {
      ...context,
      action: "write",
    });
    appendWorkspaceAuditEvent(database, {
      ...context,
      action: "resource.create",
      resourceId: id,
      resourceKind: kind,
      outcome: allowed ? "allowed" : "denied",
      reason: allowed
        ? "Database membership grants workspace resource write."
        : "No organization-scoped workspace membership grants resource write.",
    });
    if (!allowed) {
      database.exec("COMMIT;");
      transactionOpen = false;
      throw new WorkspaceDatabaseAuthorizationError();
    }
    database.prepare(`
      INSERT INTO workspace_resources(
        id, workspace_id, kind, label, revision, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(
      id,
      context.workspaceId,
      kind,
      label,
      new Date().toISOString(),
      context.subjectId,
    );
    database.exec("COMMIT;");
    transactionOpen = false;
    return {
      id,
      workspaceId: context.workspaceId,
      kind,
      label,
      revision: 1,
    };
  } catch (error) {
    if (transactionOpen) database.exec("ROLLBACK;");
    throw error;
  } finally {
    database.close();
  }
}

export function updateAuthorizedWorkspaceResource(
  context: WorkspaceDatabaseContext,
  input: { resourceId: string; label: string; expectedRevision: number },
  options: { databasePath?: string } = {},
) {
  const label = input.label.trim();
  const expectedRevision = Math.max(1, Math.round(input.expectedRevision));
  if (!input.resourceId.trim() || !label) {
    throw new Error("Workspace resource id and label are required.");
  }
  const database = openSeededDatabase(options.databasePath);
  let transactionOpen = false;
  try {
    database.exec("BEGIN IMMEDIATE;");
    transactionOpen = true;
    const organizationAllowed = hasWorkspacePermission(database, {
      ...context,
      action: "write",
    });
    const resource = organizationAllowed
      ? queryAuthorizedResource(database, {
          subjectId: context.subjectId,
          workspaceId: context.workspaceId,
          resourceId: input.resourceId,
          action: "write",
        })
      : undefined;
    if (!resource) {
      appendWorkspaceAuditEvent(database, {
        ...context,
        action: "resource.update",
        resourceId: input.resourceId,
        outcome: "denied",
        reason: "No organization-scoped workspace membership grants resource write.",
      });
      database.exec("COMMIT;");
      transactionOpen = false;
      throw new WorkspaceDatabaseAuthorizationError();
    }
    const actualRevision = Number(resource.revision || 1);
    if (actualRevision !== expectedRevision) {
      appendWorkspaceAuditEvent(database, {
        ...context,
        action: "resource.update",
        resourceId: input.resourceId,
        resourceKind: String(resource.kind || ""),
        outcome: "denied",
        reason: `Optimistic concurrency conflict: expected revision ${expectedRevision}, actual ${actualRevision}.`,
      });
      database.exec("COMMIT;");
      transactionOpen = false;
      throw new WorkspaceDatabaseConflictError(
        expectedRevision,
        actualRevision,
      );
    }
    const nextRevision = actualRevision + 1;
    const updatedAt = new Date().toISOString();
    database.prepare(`
      UPDATE workspace_resources
      SET label = ?, revision = ?, updated_at = ?, updated_by = ?
      WHERE id = ? AND workspace_id = ? AND revision = ?
    `).run(
      label,
      nextRevision,
      updatedAt,
      context.subjectId,
      input.resourceId,
      context.workspaceId,
      actualRevision,
    );
    appendWorkspaceAuditEvent(database, {
      ...context,
      action: "resource.update",
      resourceId: input.resourceId,
      resourceKind: String(resource.kind || ""),
      outcome: "allowed",
      reason: `Resource advanced from revision ${actualRevision} to ${nextRevision}.`,
    });
    database.exec("COMMIT;");
    transactionOpen = false;
    return {
      id: input.resourceId,
      workspaceId: context.workspaceId,
      kind: String(resource.kind || ""),
      label,
      revision: nextRevision,
      updatedAt,
      updatedBy: context.subjectId,
    };
  } catch (error) {
    if (transactionOpen) database.exec("ROLLBACK;");
    throw error;
  } finally {
    database.close();
  }
}

export function replaceWorkspaceDirectoryGroupMapping(
  input: {
    organizationId: string;
    workspaceId: string;
    externalGroupId: string;
    groupLabel: string;
    role: WorkspaceRole;
    members: Array<{
      subjectId: string;
      label: string;
      active: boolean;
    }>;
  },
  options: { databasePath?: string } = {},
) {
  const database = openSeededDatabase(options.databasePath);
  const groupId = `directory-group-${input.organizationId}-${input.externalGroupId}`;
  let transactionOpen = false;
  try {
    database.exec("BEGIN IMMEDIATE;");
    transactionOpen = true;
    const workspace = database
      .prepare(
        "SELECT id FROM workspaces WHERE id = ? AND organization_id = ?",
      )
      .get(input.workspaceId, input.organizationId);
    if (!workspace) {
      throw new Error(
        "Group mapping workspace does not belong to the requested organization.",
      );
    }
    database.prepare(`
      INSERT INTO directory_groups(id, organization_id, external_id, label)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(organization_id, external_id)
      DO UPDATE SET label = excluded.label
    `).run(
      groupId,
      input.organizationId,
      input.externalGroupId,
      input.groupLabel,
    );
    database
      .prepare("DELETE FROM directory_group_members WHERE group_id = ?")
      .run(groupId);
    const activeMembers = input.members.filter(
      (member) => member.active && member.subjectId.trim(),
    );
    for (const member of activeMembers) {
      database.prepare(`
        INSERT INTO subjects(id, kind, label) VALUES (?, 'user', ?)
        ON CONFLICT(id) DO UPDATE SET label = excluded.label
      `).run(member.subjectId, member.label || member.subjectId);
      database.prepare(`
        INSERT INTO directory_group_members(group_id, subject_id)
        VALUES (?, ?)
      `).run(groupId, member.subjectId);
      database.prepare(`
        INSERT INTO memberships(subject_id, workspace_id, role)
        VALUES (?, ?, ?)
        ON CONFLICT(subject_id, workspace_id)
        DO UPDATE SET role = excluded.role
      `).run(member.subjectId, input.workspaceId, input.role);
    }
    database.prepare(`
      INSERT INTO group_workspace_role_mappings(group_id, workspace_id, role)
      VALUES (?, ?, ?)
      ON CONFLICT(group_id, workspace_id)
      DO UPDATE SET role = excluded.role
    `).run(groupId, input.workspaceId, input.role);
    database.exec("COMMIT;");
    transactionOpen = false;
    return {
      groupId,
      externalGroupId: input.externalGroupId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      role: input.role,
      activeMemberCount: activeMembers.length,
    };
  } catch (error) {
    if (transactionOpen) database.exec("ROLLBACK;");
    throw error;
  } finally {
    database.close();
  }
}

export function resolveWorkspaceAssignmentsForOidcIdentity(
  input: { subjectId: string; groupClaims: string[] },
  options: { databasePath?: string } = {},
) {
  if (!input.groupClaims.length) return [];
  const database = openSeededDatabase(options.databasePath);
  try {
    const placeholders = input.groupClaims.map(() => "?").join(", ");
    return database.prepare(`
      SELECT DISTINCT g.organization_id AS organizationId,
        m.workspace_id AS workspaceId, m.role, g.external_id AS externalGroupId,
        g.label AS groupLabel
      FROM directory_group_members gm
      JOIN directory_groups g ON g.id = gm.group_id
      JOIN group_workspace_role_mappings m ON m.group_id = g.id
      JOIN workspaces w
        ON w.id = m.workspace_id
       AND w.organization_id = g.organization_id
      WHERE gm.subject_id = ?
        AND (g.external_id IN (${placeholders}) OR g.label IN (${placeholders}))
      ORDER BY g.organization_id, m.workspace_id
    `).all(
      input.subjectId,
      ...input.groupClaims,
      ...input.groupClaims,
    ) as Array<{
      organizationId: string;
      workspaceId: string;
      role: WorkspaceRole;
      externalGroupId: string;
      groupLabel: string;
    }>;
  } finally {
    database.close();
  }
}

export function readWorkspaceAuditEvents(
  context: WorkspaceDatabaseContext,
  options: { limit?: number; databasePath?: string } = {},
) {
  const database = openSeededDatabase(options.databasePath);
  try {
    if (!hasWorkspacePermission(database, { ...context, action: "admin" })) {
      throw new WorkspaceDatabaseAuthorizationError(
        "Workspace admin permission is required to read audit events.",
      );
    }
    const limit = Math.max(1, Math.min(200, Math.round(options.limit || 50)));
    return database.prepare(`
      SELECT id, occurred_at AS occurredAt, request_id AS requestId,
        subject_id AS subjectId, workspace_id AS workspaceId, action,
        resource_id AS resourceId, resource_kind AS resourceKind, outcome, reason
      FROM workspace_audit_events
      WHERE workspace_id = ?
      ORDER BY occurred_at DESC, id DESC
      LIMIT ?
    `).all(context.workspaceId, limit);
  } finally {
    database.close();
  }
}

export function readWorkspaceAclDatabase() {
  const database = openSeededDatabase();
  try {
    const migrationRows = database.prepare("SELECT version, name, applied_at AS appliedAt FROM schema_migrations ORDER BY version").all();
    const counts = {
      organizations: Number(database.prepare("SELECT COUNT(*) AS count FROM organizations").get()?.count || 0),
      workspaces: Number(database.prepare("SELECT COUNT(*) AS count FROM workspaces").get()?.count || 0),
      subjects: Number(database.prepare("SELECT COUNT(*) AS count FROM subjects").get()?.count || 0),
      memberships: Number(database.prepare("SELECT COUNT(*) AS count FROM memberships").get()?.count || 0),
      directoryGroups: Number(database.prepare("SELECT COUNT(*) AS count FROM directory_groups").get()?.count || 0),
      directoryGroupMembers: Number(database.prepare("SELECT COUNT(*) AS count FROM directory_group_members").get()?.count || 0),
      groupWorkspaceMappings: Number(database.prepare("SELECT COUNT(*) AS count FROM group_workspace_role_mappings").get()?.count || 0),
      resources: Number(database.prepare("SELECT COUNT(*) AS count FROM workspace_resources").get()?.count || 0),
      auditEvents: Number(database.prepare("SELECT COUNT(*) AS count FROM workspace_audit_events").get()?.count || 0),
    };
    return {
      ok: true as const,
      schemaVersion: WORKSPACE_ACL_DATABASE_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      databasePath: DATABASE_FILE,
      migrationRows,
      counts,
      localAccess: {
        allowed: Boolean(queryAuthorizedResource(database, {
          subjectId: "local-operator",
          workspaceId: "local-workspace",
          resourceId: "local-workflow",
          action: "execute",
        })),
      },
      enforcement: "sql-join-membership-permission-workspace" as const,
    };
  } finally {
    database.close();
  }
}

export function runWorkspaceIsolationRehearsal() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "first-llm-workspace-acl-"));
  const databasePath = path.join(directory, "workspace-acl.sqlite");
  const database = openDatabase(databasePath);
  try {
    seedLocalWorkspace(database);
    database.prepare("INSERT INTO organizations(id, label) VALUES (?, ?)").run("org-b", "Organization B");
    database.prepare("INSERT INTO workspaces(id, organization_id, label) VALUES (?, ?, ?)").run("workspace-b", "org-b", "Workspace B");
    database.prepare("INSERT INTO subjects(id, kind, label) VALUES (?, ?, ?)").run("user-b", "user", "User B");
    database.prepare("INSERT INTO memberships(subject_id, workspace_id, role) VALUES (?, ?, ?)").run("user-b", "workspace-b", "viewer");
    database.prepare("INSERT INTO workspace_resources(id, workspace_id, kind, label) VALUES (?, ?, ?, ?)").run("private-b", "workspace-b", "knowledge", "Private B");
    const sameWorkspaceAllowed = Boolean(queryAuthorizedResource(database, {
      subjectId: "user-b",
      workspaceId: "workspace-b",
      resourceId: "private-b",
      action: "read",
    }));
    const crossWorkspaceDenied = !queryAuthorizedResource(database, {
      subjectId: "local-operator",
      workspaceId: "workspace-b",
      resourceId: "private-b",
      action: "read",
    });
    const roleWriteDenied = !queryAuthorizedResource(database, {
      subjectId: "user-b",
      workspaceId: "workspace-b",
      resourceId: "private-b",
      action: "write",
    });
    const context: WorkspaceDatabaseContext = {
      requestId: "workspace-rehearsal",
      subjectId: "local-operator",
      workspaceId: "local-workspace",
      organizationId: "local-organization",
    };
    const created = createAuthorizedWorkspaceResource(
      context,
      {
        id: "workspace-audit-proof",
        kind: "workflow",
        label: "Audit proof",
      },
      { databasePath },
    );
    const auditRows = readWorkspaceAuditEvents(context, {
      databasePath,
      limit: 10,
    });
    let immutableAudit = false;
    try {
      database
        .prepare(
          "UPDATE workspace_audit_events SET reason = ? WHERE request_id = ?",
        )
        .run("tampered", context.requestId);
    } catch {
      immutableAudit = true;
    }
    const checks = {
      sameWorkspaceAllowed,
      crossWorkspaceDenied,
      roleWriteDenied,
      workspaceWriteScoped: created.workspaceId === context.workspaceId,
      auditRecorded: auditRows.some(
        (row) => row.requestId === context.requestId,
      ),
      immutableAudit,
    };
    return {
      ok: Object.values(checks).every(Boolean),
      schemaVersion: WORKSPACE_ACL_DATABASE_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      checks,
      enforcement: "database-query" as const,
    };
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

export function runWorkspaceMultiUserConflictRehearsal() {
  const directory = mkdtempSync(
    path.join(os.tmpdir(), "first-llm-workspace-conflict-"),
  );
  const databasePath = path.join(directory, "workspace-acl.sqlite");
  const bootstrap = openDatabase(databasePath);
  try {
    seedLocalWorkspace(bootstrap);
    bootstrap
      .prepare("INSERT INTO subjects(id, kind, label) VALUES (?, ?, ?)")
      .run("builder-b", "user", "Builder B");
    bootstrap
      .prepare(
        "INSERT INTO memberships(subject_id, workspace_id, role) VALUES (?, ?, ?)",
      )
      .run("builder-b", "local-workspace", "builder");
  } finally {
    bootstrap.close();
  }

  const ownerContext: WorkspaceDatabaseContext = {
    requestId: "conflict-owner-create",
    subjectId: "local-operator",
    workspaceId: "local-workspace",
    organizationId: "local-organization",
  };
  const builderContext: WorkspaceDatabaseContext = {
    requestId: "conflict-builder-stale-write",
    subjectId: "builder-b",
    workspaceId: "local-workspace",
    organizationId: "local-organization",
  };
  try {
    const created = createAuthorizedWorkspaceResource(
      ownerContext,
      {
        id: "shared-workflow",
        kind: "workflow",
        label: "Shared workflow v1",
      },
      { databasePath },
    );
    const ownerUpdate = updateAuthorizedWorkspaceResource(
      { ...ownerContext, requestId: "conflict-owner-update" },
      {
        resourceId: created.id,
        label: "Shared workflow v2",
        expectedRevision: created.revision,
      },
      { databasePath },
    );
    let staleConflict: WorkspaceDatabaseConflictError | null = null;
    try {
      updateAuthorizedWorkspaceResource(
        builderContext,
        {
          resourceId: created.id,
          label: "Builder stale overwrite",
          expectedRevision: created.revision,
        },
        { databasePath },
      );
    } catch (error) {
      if (error instanceof WorkspaceDatabaseConflictError) {
        staleConflict = error;
      } else {
        throw error;
      }
    }
    const current = listAuthorizedWorkspaceResources(ownerContext, {
      databasePath,
    }).find((resource) => resource.id === created.id);
    const auditRows = readWorkspaceAuditEvents(ownerContext, {
      databasePath,
      limit: 20,
    });
    const checks = {
      firstWriterAdvancedRevision: ownerUpdate.revision === 2,
      secondWriterReceivedConflict: staleConflict?.status === 409,
      staleWriteDidNotOverwrite: current?.label === "Shared workflow v2",
      revisionRemainsMonotonic: current?.revision === 2,
      conflictAuditRecorded: auditRows.some(
        (row) =>
          row.requestId === builderContext.requestId &&
          row.outcome === "denied" &&
          String(row.reason).includes("Optimistic concurrency conflict"),
      ),
    };
    return {
      ok: Object.values(checks).every(Boolean),
      schemaVersion: WORKSPACE_ACL_DATABASE_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      checks,
      conflict: staleConflict
        ? {
            code: staleConflict.code,
            status: staleConflict.status,
            expectedRevision: staleConflict.expectedRevision,
            actualRevision: staleConflict.actualRevision,
          }
        : null,
      winner: current || null,
      auditEventCount: auditRows.length,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
