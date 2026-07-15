import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { createRequire } from "module";
import os from "os";
import path from "path";

export const WORKSPACE_ACL_DATABASE_SCHEMA_VERSION =
  "governance.workspace-acl-database.v1" as const;

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
] as const;

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
    SELECT r.id, r.workspace_id AS workspaceId, r.kind, r.label, m.role
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

export function readWorkspaceAclDatabase() {
  const database = openDatabase();
  try {
    seedLocalWorkspace(database);
    const migrationRows = database.prepare("SELECT version, name, applied_at AS appliedAt FROM schema_migrations ORDER BY version").all();
    const counts = {
      organizations: Number(database.prepare("SELECT COUNT(*) AS count FROM organizations").get()?.count || 0),
      workspaces: Number(database.prepare("SELECT COUNT(*) AS count FROM workspaces").get()?.count || 0),
      subjects: Number(database.prepare("SELECT COUNT(*) AS count FROM subjects").get()?.count || 0),
      memberships: Number(database.prepare("SELECT COUNT(*) AS count FROM memberships").get()?.count || 0),
      resources: Number(database.prepare("SELECT COUNT(*) AS count FROM workspace_resources").get()?.count || 0),
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
    const checks = { sameWorkspaceAllowed, crossWorkspaceDenied, roleWriteDenied };
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
