import { randomUUID } from "crypto";
import os from "os";
import path from "path";
import {
  readJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";

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
type LedgerStore = { schemaVersion: typeof SERVER_REQUEST_LEDGER_SCHEMA_VERSION; entries: ServerRequestEntry[] };
function emptyStore(): LedgerStore { return { schemaVersion: SERVER_REQUEST_LEDGER_SCHEMA_VERSION, entries: [] }; }
function isStore(value: unknown): value is LedgerStore { if (!value || typeof value !== "object") return false; const candidate = value as Partial<LedgerStore>; return candidate.schemaVersion === SERVER_REQUEST_LEDGER_SCHEMA_VERSION && Array.isArray(candidate.entries); }

function readEntries(): ServerRequestEntry[] {
  return readJsonFileDurably(LEDGER_FILE, emptyStore, isStore).entries;
}

export function appendServerRequestEntry(input: Omit<ServerRequestEntry, "id" | "createdAt">) {
  const entry: ServerRequestEntry = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
  updateJsonFileDurably(
    LEDGER_FILE,
    emptyStore,
    (store) => ({ ...store, entries: [entry, ...store.entries].slice(0, 5_000) }),
    isStore,
  );
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
