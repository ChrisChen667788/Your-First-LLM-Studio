import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import {
  createProtectedToolResumeGraph,
  type WorkflowGraph,
  type WorkflowNode,
} from "@/features/workflows/graph-contract";
import { workflowNodeHasBreakpoint } from "@/features/workflows/breakpoint-store";
import { resolveWorkflowGraph } from "@/features/workflows/graph-registry";

export const WORKFLOW_EXECUTION_SCHEMA_VERSION = "workflows.execution.v1" as const;

export type WorkflowExecutionEvent = {
  id: string;
  type: "start" | "node-succeeded" | "approval-granted" | "approval-rejected" | "failed" | "resume" | "continue";
  at: string;
  nodeId?: string;
  condition?: string;
  idempotencyKey?: string;
  output?: string;
  error?: string;
};

export type WorkflowExecutionState = {
  schemaVersion: typeof WORKFLOW_EXECUTION_SCHEMA_VERSION;
  id: string;
  graphId: string;
  graphVersion: number;
  status: "idle" | "running" | "waiting-approval" | "paused-breakpoint" | "completed" | "failed" | "rejected";
  currentNodeId: string;
  completedNodeIds: string[];
  usedIdempotencyKeys: string[];
  events: WorkflowExecutionEvent[];
  input: string;
  output?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

type WorkflowExecutionStore = {
  schemaVersion: "workflows.execution-store.v1";
  executions: WorkflowExecutionState[];
};

const DATA_DIR =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const STORE_FILE = path.join(DATA_DIR, "workflow-executions.json");

function nodeById(graph: WorkflowGraph, nodeId: string) {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error(`Workflow node ${nodeId} was not found.`);
  return node;
}

function nextNode(graph: WorkflowGraph, current: string, condition?: string) {
  const candidates = graph.edges.filter((edge) => edge.from === current);
  const edge = candidates.find((candidate) => candidate.condition === condition) ||
    candidates.find((candidate) => !candidate.condition);
  return edge ? nodeById(graph, edge.to) : null;
}

function statusForNode(node: WorkflowNode | null) {
  if (!node) return "completed" as const;
  return node.kind === "approval" ? "waiting-approval" as const : "running" as const;
}

export function createWorkflowExecution(input: string, graph = createProtectedToolResumeGraph()): WorkflowExecutionState {
  const firstNode = graph.nodes.find((node) => node.kind === "input") || graph.nodes[0];
  if (!firstNode) throw new Error("Workflow graph has no entry node.");
  const now = new Date().toISOString();
  return {
    schemaVersion: WORKFLOW_EXECUTION_SCHEMA_VERSION,
    id: `workflow-run-${randomUUID()}`,
    graphId: graph.id,
    graphVersion: graph.version,
    status: "idle",
    currentNodeId: firstNode.id,
    completedNodeIds: [],
    usedIdempotencyKeys: [],
    events: [],
    input,
    createdAt: now,
    updatedAt: now,
  };
}

export function reduceWorkflowExecution(
  state: WorkflowExecutionState,
  event: WorkflowExecutionEvent,
  graph = createProtectedToolResumeGraph(),
): WorkflowExecutionState {
  if (state.events.some((entry) => entry.id === event.id)) return state;
  if (state.graphId !== graph.id || state.graphVersion !== graph.version) {
    throw new Error("Workflow execution graph version does not match the reducer graph.");
  }
  const current = nodeById(graph, state.currentNodeId);
  const base = { ...state, events: [...state.events, event], updatedAt: event.at };
  if (event.type === "start") {
    if (state.status !== "idle") throw new Error(`Cannot start a ${state.status} workflow.`);
    return { ...base, status: "running" };
  }
  if (event.type === "continue") {
    if (state.status !== "paused-breakpoint") throw new Error("Workflow is not paused at a breakpoint.");
    return { ...base, status: current.kind === "approval" ? "waiting-approval" : "running" };
  }
  if (event.type === "failed") {
    if (state.status === "completed" || state.status === "rejected") throw new Error(`Cannot fail a ${state.status} workflow.`);
    return { ...base, status: "failed", error: event.error || "Workflow node failed." };
  }
  if (event.type === "resume") {
    if (state.status !== "failed") throw new Error("Only failed workflow executions can resume.");
    if (current.resumePolicy === "manual-review") throw new Error("Manual-review nodes require a new approval decision.");
    return { ...base, status: "running", error: undefined };
  }
  if (event.type === "approval-rejected") {
    if (state.status !== "waiting-approval" || current.kind !== "approval") throw new Error("Workflow is not waiting for approval.");
    return { ...base, status: "rejected", error: event.error || "Protected action was rejected." };
  }
  if (event.type === "approval-granted") {
    if (state.status !== "waiting-approval" || current.kind !== "approval") throw new Error("Workflow is not waiting for approval.");
    const target = nextNode(graph, current.id, event.condition || "approved");
    return {
      ...base,
      status: statusForNode(target),
      currentNodeId: target?.id || current.id,
      completedNodeIds: [...new Set([...state.completedNodeIds, current.id])],
    };
  }
  if (event.type === "node-succeeded") {
    if (state.status !== "running") throw new Error(`Cannot complete a node while workflow is ${state.status}.`);
    if (event.nodeId && event.nodeId !== current.id) throw new Error("Workflow event node does not match the current node.");
    if ((current.sideEffect === "write" || current.sideEffect === "external") && current.resumePolicy === "idempotency-key") {
      if (!event.idempotencyKey) throw new Error(`Node ${current.id} requires an idempotency key.`);
      if (state.usedIdempotencyKeys.includes(event.idempotencyKey)) return state;
    }
    const target = nextNode(graph, current.id, event.condition);
    return {
      ...base,
      status: statusForNode(target),
      currentNodeId: target?.id || current.id,
      completedNodeIds: [...new Set([...state.completedNodeIds, current.id])],
      usedIdempotencyKeys: event.idempotencyKey
        ? [...new Set([...state.usedIdempotencyKeys, event.idempotencyKey])]
        : state.usedIdempotencyKeys,
      output: target ? state.output : event.output || state.output,
    };
  }
  return base;
}

function readStore(): WorkflowExecutionStore {
  if (!existsSync(STORE_FILE)) return { schemaVersion: "workflows.execution-store.v1", executions: [] };
  try {
    const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as Partial<WorkflowExecutionStore>;
    return { schemaVersion: "workflows.execution-store.v1", executions: Array.isArray(parsed.executions) ? parsed.executions : [] };
  } catch {
    return { schemaVersion: "workflows.execution-store.v1", executions: [] };
  }
}

function writeStore(store: WorkflowExecutionStore) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export function readWorkflowExecutions() {
  const store = readStore();
  return {
    schemaVersion: "workflows.execution-store.v1" as const,
    executions: store.executions.slice(0, 100),
    path: STORE_FILE,
  };
}

export function createPersistedWorkflowExecution(input: string, graph = createProtectedToolResumeGraph()) {
  const store = readStore();
  const execution = createWorkflowExecution(input, graph);
  writeStore({ ...store, executions: [execution, ...store.executions].slice(0, 100) });
  return execution;
}

export function dispatchPersistedWorkflowEvent(executionId: string, event: Omit<WorkflowExecutionEvent, "id" | "at"> & { id?: string; at?: string }) {
  const store = readStore();
  const current = store.executions.find((execution) => execution.id === executionId);
  if (!current) throw new Error("Workflow execution was not found.");
  const graph = resolveWorkflowGraph(current.graphId, current.graphVersion);
  if (!graph) throw new Error("Workflow execution graph is no longer available.");
  let next = reduceWorkflowExecution(current, {
    ...event,
    id: event.id || randomUUID(),
    at: event.at || new Date().toISOString(),
  }, graph);
  const moved = next.currentNodeId !== current.currentNodeId || event.type === "start";
  if (
    moved &&
    next.status !== "completed" &&
    next.status !== "failed" &&
    next.status !== "rejected" &&
    workflowNodeHasBreakpoint(next.graphId, next.graphVersion, next.currentNodeId)
  ) {
    next = { ...next, status: "paused-breakpoint", updatedAt: new Date().toISOString() };
  }
  writeStore({ ...store, executions: store.executions.map((execution) => execution.id === executionId ? next : execution) });
  return next;
}
