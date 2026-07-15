import { existsSync, readFileSync } from "fs";
import os from "os";
import path from "path";

export const POSTGRES_RLS_EVIDENCE_SCHEMA_VERSION = "governance.postgres-rls-evidence.v1" as const;

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const RECEIPT_FILE = path.join(DATA_DIR, "postgres-rls-rehearsal.json");

export function readPostgresRlsEvidence() {
  let rehearsal: Record<string, unknown> | null = null;
  if (existsSync(RECEIPT_FILE)) {
    try { rehearsal = JSON.parse(readFileSync(RECEIPT_FILE, "utf8")) as Record<string, unknown>; } catch { rehearsal = null; }
  }
  return {
    ok: true as const,
    schemaVersion: POSTGRES_RLS_EVIDENCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    migration: "features/governance/migrations/002_postgres_workspace_rls.sql",
    latestPassing: rehearsal?.ok === true ? rehearsal : null,
    latest: rehearsal,
    path: RECEIPT_FILE,
  };
}
