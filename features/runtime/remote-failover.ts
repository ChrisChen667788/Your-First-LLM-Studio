import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

export const REMOTE_FAILOVER_SCHEMA_VERSION = "runtime.remote-failover.v1" as const;
type NodeLease = { nodeId: string; role: "primary" | "standby"; heartbeatAt: string; leaseSeconds: number; fencingGeneration: number };
type Receipt = { id: string; generatedAt: string; status: "pass" | "hold"; selectedNodeId?: string; fencedNodeId?: string; fencingToken?: string; checks: Record<string, boolean>; candidates: Array<{ nodeId: string; fresh: boolean }>; warning: string };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability"); const STORE_FILE = path.join(DATA_DIR, "runtime-remote-failover.json");
function readReceipts(): Receipt[] { if (!existsSync(STORE_FILE)) return []; try { const value = JSON.parse(readFileSync(STORE_FILE, "utf8")) as { receipts?: Receipt[] }; return Array.isArray(value.receipts) ? value.receipts : []; } catch { return []; } }
function persist(receipt: Receipt) { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(STORE_FILE, `${JSON.stringify({ schemaVersion: REMOTE_FAILOVER_SCHEMA_VERSION, receipts: [receipt, ...readReceipts()].slice(0, 100) }, null, 2)}\n`, "utf8"); }
export function routeRemoteFailover(input: { leases: NodeLease[]; now?: Date }) {
  const now = input.now || new Date(); const candidates = input.leases.map((lease) => ({ nodeId: lease.nodeId, fresh: now.getTime() - Date.parse(lease.heartbeatAt) <= lease.leaseSeconds * 1_000 })); const fresh = input.leases.filter((lease) => candidates.find((entry) => entry.nodeId === lease.nodeId)?.fresh).sort((a, b) => (a.role === "primary" ? -1 : 1) - (b.role === "primary" ? -1 : 1)); const selected = fresh[0]; const stalePrimary = input.leases.find((lease) => lease.role === "primary" && !candidates.find((entry) => entry.nodeId === lease.nodeId)?.fresh); const nextGeneration = Math.max(0, ...input.leases.map((entry) => entry.fencingGeneration)) + 1;
  return { selectedNodeId: selected?.nodeId, fencedNodeId: stalePrimary?.nodeId, fencingToken: selected && stalePrimary ? `${selected.nodeId}:${nextGeneration}` : undefined, candidates };
}
export function rehearseRemoteFailover() {
  const now = new Date("2026-07-16T00:00:00.000Z"); const result = routeRemoteFailover({ now, leases: [
    { nodeId: "node-primary", role: "primary", heartbeatAt: "2026-07-15T23:58:00.000Z", leaseSeconds: 30, fencingGeneration: 7 },
    { nodeId: "node-standby", role: "standby", heartbeatAt: "2026-07-15T23:59:55.000Z", leaseSeconds: 30, fencingGeneration: 7 },
  ] });
  const checks = { stalePrimaryExcluded: result.fencedNodeId === "node-primary", freshStandbySelected: result.selectedNodeId === "node-standby", fencingGenerationAdvanced: result.fencingToken === "node-standby:8", noSplitBrainSelection: result.candidates.filter((entry) => entry.fresh).length === 1 };
  const receipt: Receipt = { id: `remote-failover-${randomUUID()}`, generatedAt: new Date().toISOString(), status: Object.values(checks).every(Boolean) ? "pass" : "hold", ...result, checks, warning: "This is a deterministic lease/fencing rehearsal over loopback-style node records, not real multi-machine failover evidence." }; persist(receipt); return receipt;
}
export function readRemoteFailoverEvidence() { const receipts = readReceipts(); return { ok: true as const, schemaVersion: REMOTE_FAILOVER_SCHEMA_VERSION, generatedAt: new Date().toISOString(), receipts, latestPassing: receipts.find((entry) => entry.status === "pass") || null, path: STORE_FILE }; }
