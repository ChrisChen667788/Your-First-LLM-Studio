import os from "os";
import path from "path";
import { readDurableJsonStore, updateDurableJsonStore } from "@/features/persistence/durable-json-store";

export const WORKFLOW_BREAKPOINT_SCHEMA_VERSION = "workflows.breakpoints.v1" as const;

type BreakpointStore = {
  schemaVersion: typeof WORKFLOW_BREAKPOINT_SCHEMA_VERSION;
  breakpoints: Array<{ graphId: string; graphVersion: number; nodeId: string; enabled: boolean; updatedAt: string }>;
};

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(
  os.homedir(), "Library", "Application Support", "local-agent-lab", "observability",
);
const STORE_FILE = path.join(DATA_DIR, "workflow-breakpoints.json");

function isBreakpointStore(value: unknown): value is BreakpointStore {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BreakpointStore>;
  return candidate.schemaVersion === WORKFLOW_BREAKPOINT_SCHEMA_VERSION && Array.isArray(candidate.breakpoints);
}

const storeOptions = {
  filePath: STORE_FILE,
  initial: (): BreakpointStore => ({ schemaVersion: WORKFLOW_BREAKPOINT_SCHEMA_VERSION, breakpoints: [] }),
  validate: isBreakpointStore,
};

function readStore() {
  return readDurableJsonStore(storeOptions);
}

export function readWorkflowBreakpoints() {
  return { ...readStore(), generatedAt: new Date().toISOString(), path: STORE_FILE };
}

export function workflowNodeHasBreakpoint(graphId: string, graphVersion: number, nodeId: string) {
  return readStore().breakpoints.some((entry) => entry.graphId === graphId && entry.graphVersion === graphVersion && entry.nodeId === nodeId && entry.enabled);
}

export function setWorkflowBreakpoint(input: { graphId: string; graphVersion: number; nodeId: string; enabled: boolean }) {
  if (!input.graphId.trim() || !input.nodeId.trim()) throw new Error("graphId and nodeId are required.");
  const next = {
    graphId: input.graphId,
    graphVersion: input.graphVersion,
    nodeId: input.nodeId,
    enabled: input.enabled,
    updatedAt: new Date().toISOString(),
  };
  updateDurableJsonStore(storeOptions, (store) => ({
    ...store,
    breakpoints: [next, ...store.breakpoints.filter((entry) =>
      !(entry.graphId === input.graphId && entry.graphVersion === input.graphVersion && entry.nodeId === input.nodeId),
    )].slice(0, 500),
  }));
  return next;
}
