import { randomUUID } from "crypto";
import os from "os";
import path from "path";
import { readJsonFileDurably, updateJsonFileDurably } from "@/features/persistence/durable-json-file";
import type { RuntimeBackend } from "@/features/runtime/operation-port";

export const REMOTE_NODE_REGISTRY_SCHEMA_VERSION = "runtime.remote-node-registry.v1" as const;
type NodeRecord = { id: string; label: string; baseUrl: string; authMode: "api-key" | "mtls"; platforms: string[]; backends: RuntimeBackend[]; memoryGb: number; residency: string; state: "ready" | "unavailable"; createdAt: string; updatedAt: string };
type Receipt = { id: string; generatedAt: string; status: "pass" | "hold"; request: { backend: RuntimeBackend; minimumMemoryGb: number; residency: string }; selectedNodeId?: string; candidates: Array<{ nodeId: string; compatible: boolean; reasons: string[] }>; blockers: string[] };
type Store = { schemaVersion: typeof REMOTE_NODE_REGISTRY_SCHEMA_VERSION; nodes: NodeRecord[]; receipts: Receipt[] };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const STORE_FILE = path.join(DATA_DIR, "runtime-remote-nodes.json");
const emptyStore = (): Store => ({ schemaVersion: REMOTE_NODE_REGISTRY_SCHEMA_VERSION, nodes: [], receipts: [] });
const isStore = (value: unknown): value is Store => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Store>;
  return candidate.schemaVersion === REMOTE_NODE_REGISTRY_SCHEMA_VERSION && Array.isArray(candidate.nodes) && Array.isArray(candidate.receipts);
};
const readStore = () => readJsonFileDurably(STORE_FILE, emptyStore, isStore);
const updateStore = (mutator: (store: Store) => Store) => updateJsonFileDurably(STORE_FILE, emptyStore, mutator, isStore);

export function upsertRemoteNode(input: Omit<NodeRecord, "createdAt" | "updatedAt">) {
  const url = new URL(input.baseUrl);
  if (url.protocol !== "https:" && !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Remote nodes require HTTPS unless they are loopback rehearsal nodes.");
  if (!input.backends.length) throw new Error("At least one backend capability is required.");
  const outcome: { value?: NodeRecord } = {};
  updateStore((store) => {
    const existing = store.nodes.find((entry) => entry.id === input.id);
    const now = new Date().toISOString();
    const node: NodeRecord = { ...input, createdAt: existing?.createdAt || now, updatedAt: now };
    outcome.value = node;
    return { ...store, nodes: [node, ...store.nodes.filter((entry) => entry.id !== node.id)] };
  });
  if (!outcome.value) throw new Error("Remote node update did not complete.");
  return outcome.value;
}

export function routeRemoteNode(input: { backend: RuntimeBackend; minimumMemoryGb: number; residency: string }) {
  const outcome: { value?: Receipt } = {};
  updateStore((store) => {
    const candidates = store.nodes.map((node) => {
      const reasons = [node.state !== "ready" ? `Node state is ${node.state}.` : "", !node.backends.includes(input.backend) ? `Backend ${input.backend} is unavailable.` : "", node.memoryGb < input.minimumMemoryGb ? `Only ${node.memoryGb} GB is available.` : "", node.residency !== input.residency ? `Residency is ${node.residency}.` : ""].filter(Boolean);
      return { nodeId: node.id, compatible: reasons.length === 0, reasons };
    });
    const selected = candidates.find((entry) => entry.compatible);
    const blockers = selected ? [] : ["No remote node satisfies backend, memory, state, and residency policy."];
    const receipt: Receipt = { id: `remote-route-${randomUUID()}`, generatedAt: new Date().toISOString(), status: selected ? "pass" : "hold", request: input, selectedNodeId: selected?.nodeId, candidates, blockers };
    outcome.value = receipt;
    return { ...store, receipts: [receipt, ...store.receipts].slice(0, 200) };
  });
  if (!outcome.value) throw new Error("Remote route decision did not complete.");
  return outcome.value;
}

export function rehearseRemoteNodeRouting() {
  upsertRemoteNode({ id: "local-remote-rehearsal", label: "Loopback remote node rehearsal", baseUrl: "http://127.0.0.1:11434", authMode: "api-key", platforms: ["darwin-arm64"], backends: ["ollama"], memoryGb: 32, residency: "local", state: "ready" });
  return routeRemoteNode({ backend: "ollama", minimumMemoryGb: 8, residency: "local" });
}

export function readRemoteNodeRegistryEvidence() {
  const store = readStore();
  return { ...store, ok: true as const, schemaVersion: REMOTE_NODE_REGISTRY_SCHEMA_VERSION, generatedAt: new Date().toISOString(), latestPassing: store.receipts.find((entry) => entry.status === "pass") || null, totals: { nodes: store.nodes.length, ready: store.nodes.filter((entry) => entry.state === "ready").length }, path: STORE_FILE };
}
