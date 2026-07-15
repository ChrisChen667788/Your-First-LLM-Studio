export const WORKFLOW_GRAPH_SCHEMA_VERSION = "workflows.graph.v1" as const;

export type WorkflowNodeKind =
  | "input"
  | "model"
  | "retrieval"
  | "tool"
  | "approval"
  | "evaluator"
  | "output";

export type WorkflowNode = {
  id: string;
  kind: WorkflowNodeKind;
  label: string;
  config: Record<string, string | number | boolean>;
  sideEffect: "none" | "read" | "write" | "external";
  resumePolicy: "replay-safe" | "idempotency-key" | "manual-review";
};

export type WorkflowEdge = {
  from: string;
  to: string;
  condition?: string;
};

export type WorkflowGraph = {
  schemaVersion: typeof WORKFLOW_GRAPH_SCHEMA_VERSION;
  id: string;
  version: number;
  label: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

export function validateWorkflowGraph(graph: WorkflowGraph) {
  const errors: string[] = [];
  const nodeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) errors.push(`Duplicate node id: ${node.id}`);
    nodeIds.add(node.id);
    if (
      (node.sideEffect === "write" || node.sideEffect === "external") &&
      node.resumePolicy === "replay-safe"
    ) {
      errors.push(`Side-effect node ${node.id} cannot use replay-safe resume.`);
    }
  }
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      errors.push(`Edge ${edge.from}->${edge.to} references a missing node.`);
    }
  }
  const adjacency = new Map<string, string[]>();
  graph.edges.forEach((edge) => adjacency.set(edge.from, [...(adjacency.get(edge.from) || []), edge.to]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const hasCycle = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    const cycle = (adjacency.get(nodeId) || []).some(hasCycle);
    visiting.delete(nodeId);
    visited.add(nodeId);
    return cycle;
  };
  if (graph.nodes.some((node) => hasCycle(node.id))) errors.push("Workflow graph contains a cycle.");
  return { valid: errors.length === 0, errors };
}

export function createProtectedToolResumeGraph(): WorkflowGraph {
  return {
    schemaVersion: WORKFLOW_GRAPH_SCHEMA_VERSION,
    id: "agent-protected-tool-resume",
    version: 1,
    label: "Agent protected tool and resume",
    nodes: [
      { id: "prompt", kind: "input", label: "User prompt", config: {}, sideEffect: "none", resumePolicy: "replay-safe" },
      { id: "model", kind: "model", label: "Plan tool call", config: { profile: "active" }, sideEffect: "none", resumePolicy: "replay-safe" },
      { id: "approval", kind: "approval", label: "Review protected action", config: { required: true }, sideEffect: "none", resumePolicy: "manual-review" },
      { id: "tool", kind: "tool", label: "Execute protected action", config: { protected: true }, sideEffect: "write", resumePolicy: "idempotency-key" },
      { id: "verify", kind: "evaluator", label: "Verify tool result", config: {}, sideEffect: "read", resumePolicy: "replay-safe" },
      { id: "answer", kind: "output", label: "Final answer", config: {}, sideEffect: "none", resumePolicy: "replay-safe" },
    ],
    edges: [
      { from: "prompt", to: "model" },
      { from: "model", to: "approval", condition: "protected_tool_requested" },
      { from: "approval", to: "tool", condition: "approved" },
      { from: "tool", to: "verify" },
      { from: "verify", to: "answer" },
    ],
  };
}

export function createRetrievalGroundedAnswerGraph(): WorkflowGraph {
  return {
    schemaVersion: WORKFLOW_GRAPH_SCHEMA_VERSION,
    id: "retrieval-grounded-answer",
    version: 1,
    label: "Retrieval grounded answer",
    nodes: [
      { id: "question", kind: "input", label: "Question", config: {}, sideEffect: "none", resumePolicy: "replay-safe" },
      { id: "retrieve", kind: "retrieval", label: "Retrieve ACL-filtered evidence", config: { topK: 8, aclRequired: true }, sideEffect: "read", resumePolicy: "replay-safe" },
      { id: "generate", kind: "model", label: "Generate cited answer", config: { citationsRequired: true }, sideEffect: "none", resumePolicy: "replay-safe" },
      { id: "verify", kind: "evaluator", label: "Verify citations", config: { minimumCitations: 1 }, sideEffect: "read", resumePolicy: "replay-safe" },
      { id: "answer", kind: "output", label: "Grounded answer", config: {}, sideEffect: "none", resumePolicy: "replay-safe" },
    ],
    edges: [{ from: "question", to: "retrieve" }, { from: "retrieve", to: "generate" }, { from: "generate", to: "verify" }, { from: "verify", to: "answer" }],
  };
}

export function readWorkflowGraphFoundation() {
  const protectedToolResumeGraph = createProtectedToolResumeGraph();
  return {
    ok: true as const,
    schemaVersion: WORKFLOW_GRAPH_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    graphs: [{ graph: protectedToolResumeGraph, validation: validateWorkflowGraph(protectedToolResumeGraph) }, { graph: createRetrievalGroundedAnswerGraph(), validation: validateWorkflowGraph(createRetrievalGroundedAnswerGraph()) }],
    capabilities: ["typed-nodes", "validation", "side-effect-policy", "resume-policy", "versioned-graph", "breakpoint-store", "editor-contract"],
    blockers: ["Multi-user collaborative editing and distributed worker scheduling remain out of scope for the local safe-worker foundation."],
  };
}
