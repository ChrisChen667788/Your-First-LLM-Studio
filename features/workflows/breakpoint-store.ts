import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

export const WORKFLOW_BREAKPOINT_SCHEMA_VERSION = "workflows.breakpoints.v1" as const;

type BreakpointStore = {
  schemaVersion: typeof WORKFLOW_BREAKPOINT_SCHEMA_VERSION;
  breakpoints: Array<{ graphId: string; graphVersion: number; nodeId: string; enabled: boolean; updatedAt: string }>;
};

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(
  os.homedir(), "Library", "Application Support", "local-agent-lab", "observability",
);
const STORE_FILE = path.join(DATA_DIR, "workflow-breakpoints.json");

function readStore(): BreakpointStore {
  if (!existsSync(STORE_FILE)) return { schemaVersion: WORKFLOW_BREAKPOINT_SCHEMA_VERSION, breakpoints: [] };
  try {
    const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as Partial<BreakpointStore>;
    return { schemaVersion: WORKFLOW_BREAKPOINT_SCHEMA_VERSION, breakpoints: Array.isArray(parsed.breakpoints) ? parsed.breakpoints : [] };
  } catch {
    return { schemaVersion: WORKFLOW_BREAKPOINT_SCHEMA_VERSION, breakpoints: [] };
  }
}

function writeStore(store: BreakpointStore) {
  mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  writeFileSync(STORE_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export function readWorkflowBreakpoints() {
  return { ...readStore(), generatedAt: new Date().toISOString(), path: STORE_FILE };
}

export function workflowNodeHasBreakpoint(graphId: string, graphVersion: number, nodeId: string) {
  return readStore().breakpoints.some((entry) => entry.graphId === graphId && entry.graphVersion === graphVersion && entry.nodeId === nodeId && entry.enabled);
}

export function setWorkflowBreakpoint(input: { graphId: string; graphVersion: number; nodeId: string; enabled: boolean }) {
  if (!input.graphId.trim() || !input.nodeId.trim()) throw new Error("graphId and nodeId are required.");
  const store = readStore();
  const next = {
    graphId: input.graphId,
    graphVersion: input.graphVersion,
    nodeId: input.nodeId,
    enabled: input.enabled,
    updatedAt: new Date().toISOString(),
  };
  writeStore({
    ...store,
    breakpoints: [next, ...store.breakpoints.filter((entry) =>
      !(entry.graphId === input.graphId && entry.graphVersion === input.graphVersion && entry.nodeId === input.nodeId),
    )].slice(0, 500),
  });
  return next;
}
