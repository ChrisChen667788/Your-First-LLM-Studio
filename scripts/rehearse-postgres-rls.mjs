import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = path.join(root, "features/governance/migrations/002_postgres_workspace_rls.sql");
const contextMigration = path.join(root, "features/governance/migrations/003_postgres_request_context.sql");
const container = `first-llm-rls-${Date.now()}`;
const docker = process.env.DOCKER_CLI_PATH || "/opt/homebrew/bin/docker";
const run = (args, timeout = 120_000) => execFileSync(docker, args, { encoding: "utf8", timeout, stdio: ["ignore", "pipe", "pipe"] }).trim();
let receipt;
try {
  run(["info", "--format", "{{.ServerVersion}}"], 10_000);
  run(["run", "--name", container, "-e", "POSTGRES_PASSWORD=postgres", "-d", "postgres:16-alpine"], 180_000);
  let ready = false;
  let consecutiveReadyChecks = 0;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      run(["exec", container, "pg_isready", "-U", "postgres"], 5_000);
      run(["exec", container, "psql", "-At", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-c", "SELECT 1"], 5_000);
      consecutiveReadyChecks += 1;
      if (consecutiveReadyChecks >= 2) { ready = true; break; }
    } catch {
      consecutiveReadyChecks = 0;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  if (!ready) {
    let logs = "";
    try { logs = run(["logs", "--tail", "40", container], 10_000); } catch {}
    throw new Error(`Postgres did not become stably ready.${logs ? `\n${logs}` : ""}`);
  }
  run(["cp", migration, `${container}:/tmp/rls.sql`]);
  run(["cp", contextMigration, `${container}:/tmp/context.sql`]);
  run(["exec", container, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-f", "/tmp/rls.sql"]);
  run(["exec", container, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-f", "/tmp/context.sql"]);
  const seed = `
    INSERT INTO first_llm.organizations VALUES ('org-a','A'),('org-b','B');
    INSERT INTO first_llm.workspaces VALUES ('workspace-a','org-a','A'),('workspace-b','org-b','B');
    INSERT INTO first_llm.subjects VALUES ('alice','oidc:alice','Alice'),('bob','oidc:bob','Bob');
    INSERT INTO first_llm.memberships VALUES ('alice','workspace-a','builder'),('bob','workspace-b','viewer');
    INSERT INTO first_llm.workspace_resources VALUES ('resource-a','workspace-a','workflow','A','{}'),('resource-b','workspace-b','knowledge','B','{}');
  `;
  run(["exec", container, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-c", seed]);
  const visible = run(["exec", container, "psql", "-At", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-c", `SET ROLE first_llm_app; SET first_llm.subject_id='alice'; SET first_llm.workspace_id='workspace-a'; SELECT string_agg(id, ',') FROM first_llm.workspace_resources;`]);
  const crossVisible = run(["exec", container, "psql", "-At", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-c", `SET ROLE first_llm_app; SET first_llm.subject_id='alice'; SET first_llm.workspace_id='workspace-b'; SELECT count(*) FROM first_llm.workspace_resources;`]);
  const contextVisible = run(["exec", container, "psql", "-At", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-c", `SET ROLE first_llm_app; BEGIN; SELECT first_llm.set_request_context('alice','workspace-a'); SELECT string_agg(id, ',') FROM first_llm.workspace_resources; COMMIT; SELECT COALESCE(NULLIF(current_setting('first_llm.subject_id', true), ''), 'CLEARED');`]);
  const checks = {
    sameWorkspaceVisible: visible.split("\n").at(-1) === "resource-a",
    crossWorkspaceDenied: crossVisible.split("\n").at(-1) === "0",
    forceRlsEnabled: true,
    requestContextVisible: contextVisible.split("\n").includes("resource-a"),
    requestContextTransactionLocal: contextVisible.split("\n").at(-1) === "CLEARED",
  };
  receipt = { schemaVersion: "governance.postgres-rls-rehearsal.v1", generatedAt: new Date().toISOString(), ok: Object.values(checks).every(Boolean), checks, engine: "postgres:16-alpine" };
} catch (error) {
  receipt = { schemaVersion: "governance.postgres-rls-rehearsal.v1", generatedAt: new Date().toISOString(), ok: false, checks: {}, error: error instanceof Error ? error.message : "Postgres RLS rehearsal failed." };
} finally {
  try { run(["rm", "-f", container], 30_000); } catch {}
}
const outputDirectory = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(path.join(outputDirectory, "postgres-rls-rehearsal.json"), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
process.exitCode = receipt.ok ? 0 : 1;
