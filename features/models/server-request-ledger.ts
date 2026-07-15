import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

export const SERVER_REQUEST_LEDGER_SCHEMA_VERSION = "models.server-request-ledger.v1" as const;

export type ServerRequestEntry = {
  id: string;
  serverId: string;
  modelId: string;
  operation: "models" | "chat" | "embeddings" | "load" | "unload";
  status: "success" | "error" | "cancelled";
  statusCode?: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  callerKeyId?: string;
  profileId?: string;
  errorCode?: string;
  createdAt: string;
};

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const LEDGER_FILE = path.join(DATA_DIR, "server-request-ledger.json");

function readEntries(): ServerRequestEntry[] {
  if (!existsSync(LEDGER_FILE)) return [];
  try { const parsed = JSON.parse(readFileSync(LEDGER_FILE, "utf8")) as { entries?: ServerRequestEntry[] }; return Array.isArray(parsed.entries) ? parsed.entries : []; }
  catch { return []; }
}

function writeEntries(entries: ServerRequestEntry[]) {
  mkdirSync(path.dirname(LEDGER_FILE), { recursive: true });
  writeFileSync(LEDGER_FILE, `${JSON.stringify({ schemaVersion: SERVER_REQUEST_LEDGER_SCHEMA_VERSION, entries }, null, 2)}\n`, "utf8");
}

export function appendServerRequestEntry(input: Omit<ServerRequestEntry, "id" | "createdAt">) {
  const entry: ServerRequestEntry = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
  writeEntries([entry, ...readEntries()].slice(0, 5_000));
  return entry;
}

export function readServerRequestLedger(serverId?: string) {
  const entries = readEntries().filter((entry) => !serverId || entry.serverId === serverId);
  return {
    ok: true as const,
    schemaVersion: SERVER_REQUEST_LEDGER_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    entries,
    totals: {
      requests: entries.length,
      success: entries.filter((entry) => entry.status === "success").length,
      errors: entries.filter((entry) => entry.status === "error").length,
      promptTokens: entries.reduce((sum, entry) => sum + entry.promptTokens, 0),
      completionTokens: entries.reduce((sum, entry) => sum + entry.completionTokens, 0),
      averageLatencyMs: entries.length ? Math.round(entries.reduce((sum, entry) => sum + entry.latencyMs, 0) / entries.length) : 0,
    },
    path: LEDGER_FILE,
  };
}
