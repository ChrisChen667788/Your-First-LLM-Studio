import type {
  WorkflowExecutionState,
} from "@/features/workflows/execution-reducer";
import type {
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeKind,
} from "@/features/workflows/graph-contract";

export const WORKFLOW_NODE_OUTPUT_SCHEMA_VERSION =
  "workflows.node-output.v1" as const;

export type WorkflowNodeOutputEnvelope = {
  schemaVersion: typeof WORKFLOW_NODE_OUTPUT_SCHEMA_VERSION;
  nodeId: string;
  kind: WorkflowNodeKind;
  ok: boolean;
  summary: string;
  data: Record<string, unknown>;
};

export type WorkflowNodeExecutionResult = {
  output: string;
  condition?: string;
  executorId: string;
};

export type WorkflowNodeExecutionInput = {
  graph: WorkflowGraph;
  node: WorkflowNode;
  state: WorkflowExecutionState;
};

export type WorkflowNodeExecutor = (
  input: WorkflowNodeExecutionInput,
) => Promise<WorkflowNodeExecutionResult>;

export type WorkflowNodeExecutorRegistry = Partial<
  Record<WorkflowNodeKind, WorkflowNodeExecutor>
>;

export function encodeWorkflowNodeOutput(
  value: Omit<WorkflowNodeOutputEnvelope, "schemaVersion">,
) {
  return JSON.stringify({
    schemaVersion: WORKFLOW_NODE_OUTPUT_SCHEMA_VERSION,
    ...value,
  } satisfies WorkflowNodeOutputEnvelope);
}

export function parseWorkflowNodeOutput(
  output: string | undefined,
): WorkflowNodeOutputEnvelope | null {
  if (!output?.trim().startsWith("{")) return null;
  try {
    const value = JSON.parse(output) as Partial<WorkflowNodeOutputEnvelope>;
    if (
      value.schemaVersion !== WORKFLOW_NODE_OUTPUT_SCHEMA_VERSION ||
      typeof value.nodeId !== "string" ||
      typeof value.kind !== "string" ||
      typeof value.ok !== "boolean" ||
      typeof value.summary !== "string" ||
      !value.data ||
      typeof value.data !== "object" ||
      Array.isArray(value.data)
    ) {
      return null;
    }
    return value as WorkflowNodeOutputEnvelope;
  } catch {
    return null;
  }
}

export function findLatestWorkflowNodeEvent(
  state: WorkflowExecutionState,
  graph: WorkflowGraph,
  kind?: WorkflowNodeKind,
) {
  return [...state.events].reverse().find((event) => {
    if (!event.output || !event.nodeId) return false;
    if (!kind) return true;
    return graph.nodes.find((node) => node.id === event.nodeId)?.kind === kind;
  });
}

export function findLatestWorkflowNodeEnvelope(
  state: WorkflowExecutionState,
  graph: WorkflowGraph,
  kind: WorkflowNodeKind,
) {
  const event = findLatestWorkflowNodeEvent(state, graph, kind);
  return parseWorkflowNodeOutput(event?.output);
}

export function buildWorkflowUpstreamContext(
  state: WorkflowExecutionState,
  graph: WorkflowGraph,
) {
  const lines = state.events.flatMap((event) => {
    if (!event.nodeId || !event.output) return [];
    const node = graph.nodes.find((entry) => entry.id === event.nodeId);
    if (!node || node.kind === "input" || node.kind === "output") return [];
    const envelope = parseWorkflowNodeOutput(event.output);
    const output = envelope
      ? `${envelope.summary}\n${JSON.stringify(envelope.data)}`
      : event.output;
    return [`[${node.kind}:${node.id}]\n${output}`];
  });
  return lines.join("\n\n").slice(-16_000);
}
