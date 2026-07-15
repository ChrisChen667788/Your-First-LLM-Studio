import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { readServerInstanceRegistry, updateServerInstanceRuntime, upsertServerInstance } from "@/features/models/server-instance-registry";
import { runOllamaRuntimeAction } from "@/features/runtime/ollama-adapter";

export const SERVER_LIFECYCLE_SCHEMA_VERSION = "models.server-lifecycle.v1" as const;
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const RECEIPT_FILE = path.join(DATA_DIR, "server-lifecycle-receipts.json");
type Receipt = { id: string; generatedAt: string; serverId: string; action: "register" | "hot-switch" | "unload"; modelId?: string; status: "pass" | "failed"; error?: string };
function readReceipts(): Receipt[] { if (!existsSync(RECEIPT_FILE)) return []; try { const parsed = JSON.parse(readFileSync(RECEIPT_FILE, "utf8")) as { receipts?: Receipt[] }; return Array.isArray(parsed.receipts) ? parsed.receipts : []; } catch { return []; } }
function persist(receipt: Receipt) { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(RECEIPT_FILE, `${JSON.stringify({ schemaVersion: SERVER_LIFECYCLE_SCHEMA_VERSION, receipts: [receipt, ...readReceipts()].slice(0, 100) }, null, 2)}\n`, "utf8"); }

export async function runServerLifecycleAction(input: { serverId?: string; action?: "register" | "hot-switch" | "unload"; modelId?: string; autoEvict?: boolean; idleTtlMinutes?: number }) {
  const serverId = input.serverId?.trim() || "local-ollama";
  const action = input.action || "register";
  let status: Receipt["status"] = "pass"; let error: string | undefined;
  try {
    if (action === "register") {
      upsertServerInstance({ id: serverId, label: "Local Ollama", backend: "ollama", baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434", state: "ready", pinnedModelIds: input.modelId ? [input.modelId] : [], activeModelId: input.modelId, idleTtlMinutes: input.idleTtlMinutes || 20, autoEvict: input.autoEvict ?? true, networkExposure: "loopback", authMode: "none", trustedHosts: ["127.0.0.1", "localhost"], requestLogRetentionDays: 7, maxConcurrentRequests: 4 });
    } else {
      const instance = readServerInstanceRegistry().instances.find((entry) => entry.id === serverId);
      if (!instance) throw new Error("Server instance was not found.");
      if (instance.backend !== "ollama") throw new Error("Executable lifecycle actions currently require an Ollama server instance.");
      const modelId = input.modelId?.trim() || instance.activeModelId || instance.pinnedModelIds[0];
      if (!modelId) throw new Error("modelId is required for this lifecycle action.");
      const result = await runOllamaRuntimeAction({ action: action === "unload" ? "unload" : "prewarm", model: modelId, keepAlive: "10m" });
      if (!result.ok) throw new Error(result.error.message);
      updateServerInstanceRuntime(serverId, { state: action === "unload" ? "stopped" : "ready", activeModelId: action === "unload" ? null : modelId });
      input.modelId = modelId;
    }
  } catch (caught) { status = "failed"; error = caught instanceof Error ? caught.message : "Server lifecycle action failed."; }
  const receipt: Receipt = { id: `server-lifecycle-${randomUUID()}`, generatedAt: new Date().toISOString(), serverId, action, modelId: input.modelId, status, error };
  persist(receipt);
  return receipt;
}

export function readServerLifecycleEvidence() { const receipts = readReceipts(); return { ok: true as const, schemaVersion: SERVER_LIFECYCLE_SCHEMA_VERSION, generatedAt: new Date().toISOString(), receipts, latestPassing: receipts.find((receipt) => receipt.status === "pass") || null, registry: readServerInstanceRegistry(), path: RECEIPT_FILE }; }
