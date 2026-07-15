import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { readServerInstanceRegistry } from "@/features/models/server-instance-registry";
import { readOpenAiCompatibleConformance, runOpenAiCompatibleConformance } from "@/features/runtime/openai-compatible-conformance";

export const RUNTIME_FLEET_CONFORMANCE_SCHEMA_VERSION = "runtime.fleet-conformance.v1" as const;
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const SNAPSHOT_FILE = path.join(DATA_DIR, "runtime-fleet-conformance.json");
type Snapshot = { id: string; generatedAt: string; status: "pass" | "hold"; servers: Array<{ serverId: string; backend: string; modelId?: string; status: "passing" | "failing" | "stale" | "missing"; reportId?: string; ageMs?: number }>; blockers: string[] };
function readSnapshots(): Snapshot[] { if (!existsSync(SNAPSHOT_FILE)) return []; try { const parsed = JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8")) as { snapshots?: Snapshot[] }; return Array.isArray(parsed.snapshots) ? parsed.snapshots : []; } catch { return []; } }
function persist(snapshot: Snapshot) { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(SNAPSHOT_FILE, `${JSON.stringify({ schemaVersion: RUNTIME_FLEET_CONFORMANCE_SCHEMA_VERSION, snapshots: [snapshot, ...readSnapshots()].slice(0, 100) }, null, 2)}\n`, "utf8"); }

export function snapshotRuntimeFleetConformance() {
  const reports = readOpenAiCompatibleConformance().reports;
  const now = Date.now(); const staleAfterMs = 7 * 24 * 60 * 60 * 1000;
  const servers = readServerInstanceRegistry().instances.map((server) => {
    const report = reports.find((entry) => entry.serverId === server.id && (!server.activeModelId || entry.model === server.activeModelId));
    const ageMs = report ? Math.max(0, now - Date.parse(report.generatedAt)) : undefined;
    const status = !report ? "missing" as const : !report.ok ? "failing" as const : (ageMs || 0) > staleAfterMs ? "stale" as const : "passing" as const;
    return { serverId: server.id, backend: server.backend, modelId: server.activeModelId, status, reportId: report?.id, ageMs };
  });
  const blockers = servers.filter((server) => server.status !== "passing" && server.modelId).map((server) => `${server.serverId}/${server.modelId} is ${server.status}.`);
  const snapshot: Snapshot = { id: `fleet-${randomUUID()}`, generatedAt: new Date().toISOString(), status: blockers.length ? "hold" : "pass", servers, blockers };
  persist(snapshot); return snapshot;
}

export async function runFleetServerConformance(input: { serverId?: string; modelId?: string }) {
  const server = readServerInstanceRegistry().instances.find((entry) => entry.id === input.serverId);
  if (!server) throw new Error("Server instance was not found.");
  const model = input.modelId?.trim() || server.activeModelId || server.pinnedModelIds[0];
  if (!model) throw new Error("A model is required for fleet conformance.");
  const report = await runOpenAiCompatibleConformance({ serverId: server.id, baseUrl: server.baseUrl, model });
  return { report, snapshot: snapshotRuntimeFleetConformance() };
}

export function readRuntimeFleetConformanceEvidence() { const snapshots = readSnapshots(); return { ok: true as const, schemaVersion: RUNTIME_FLEET_CONFORMANCE_SCHEMA_VERSION, generatedAt: new Date().toISOString(), snapshots, latestPassing: snapshots.find((snapshot) => snapshot.status === "pass") || null, latest: snapshots[0] || null, path: SNAPSHOT_FILE }; }
