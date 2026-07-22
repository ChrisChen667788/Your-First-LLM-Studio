export const WORKFLOW_GRAPH_SCHEMA_VERSION = "workflows.graph.v1" as const;

export type WorkflowNodeKind =
  | "input"
  | "model"
  | "retrieval"
  | "tool"
  | "guard"
  | "approval"
  | "evaluator"
  | "output";

export type WorkflowNodePosition = {
  x: number;
  y: number;
};

export type WorkflowRuntimeProfile = {
  id: string;
  label: string;
  target: string;
  model: string;
  temperature: number;
  maxTokens: number;
  contextWindow: number;
  toolMode: "off" | "auto" | "required";
};

export type WorkflowArtifactInput = {
  id: string;
  kind: "prompt" | "dataset" | "knowledge-base" | "profile" | "tool-policy";
  digest: string;
};

export type WorkflowNode = {
  id: string;
  kind: WorkflowNodeKind;
  label: string;
  config: Record<string, string | number | boolean>;
  sideEffect: "none" | "read" | "write" | "external";
  resumePolicy: "replay-safe" | "idempotency-key" | "manual-review";
  position?: WorkflowNodePosition;
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
  runtimeProfile?: WorkflowRuntimeProfile;
  artifactInputs?: WorkflowArtifactInput[];
};

export function validateWorkflowGraph(graph: WorkflowGraph) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeKinds = new Set<WorkflowNodeKind>(["input", "model", "retrieval", "tool", "guard", "approval", "evaluator", "output"]);
  if (graph.schemaVersion !== WORKFLOW_GRAPH_SCHEMA_VERSION) errors.push(`Unsupported graph schema: ${String(graph.schemaVersion)}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(graph.id)) errors.push("Graph id must use lowercase kebab-case.");
  if (!Number.isInteger(graph.version) || graph.version < 1) errors.push("Graph version must be a positive integer.");
  if (!graph.label.trim()) errors.push("Graph label is required.");
  if (graph.nodes.length < 2 || graph.nodes.length > 64) errors.push("Workflow graph must contain 2 to 64 nodes.");
  const nodeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(node.id)) errors.push(`Node id ${node.id || "<empty>"} must use lowercase kebab-case.`);
    if (nodeIds.has(node.id)) errors.push(`Duplicate node id: ${node.id}`);
    nodeIds.add(node.id);
    if (!nodeKinds.has(node.kind)) errors.push(`Unsupported node kind on ${node.id}: ${String(node.kind)}`);
    if (!node.label.trim()) errors.push(`Node ${node.id} requires a label.`);
    if (node.position && (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y))) {
      errors.push(`Node ${node.id} has an invalid editor position.`);
    }
    if (
      (node.sideEffect === "write" || node.sideEffect === "external") &&
      node.resumePolicy === "replay-safe"
    ) {
      errors.push(`Side-effect node ${node.id} cannot use replay-safe resume.`);
    }
    if (node.kind === "approval" && node.resumePolicy !== "manual-review") {
      errors.push(`Approval node ${node.id} must use manual-review resume.`);
    }
  }
  const inputNodes = graph.nodes.filter((node) => node.kind === "input");
  const outputNodes = graph.nodes.filter((node) => node.kind === "output");
  if (inputNodes.length !== 1) errors.push("Workflow graph must contain exactly one input node.");
  if (outputNodes.length < 1) errors.push("Workflow graph must contain at least one output node.");
  const edgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      errors.push(`Edge ${edge.from}->${edge.to} references a missing node.`);
    }
    if (edge.from === edge.to) errors.push(`Edge ${edge.from}->${edge.to} cannot reference itself.`);
    const edgeId = `${edge.from}->${edge.to}:${edge.condition || ""}`;
    if (edgeIds.has(edgeId)) errors.push(`Duplicate edge: ${edgeId}`);
    edgeIds.add(edgeId);
  }
  for (const inputNode of inputNodes) {
    if (graph.edges.some((edge) => edge.to === inputNode.id)) errors.push(`Input node ${inputNode.id} cannot have inbound edges.`);
  }
  for (const outputNode of outputNodes) {
    if (graph.edges.some((edge) => edge.from === outputNode.id)) errors.push(`Output node ${outputNode.id} cannot have outbound edges.`);
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
  const entry = inputNodes[0];
  if (entry) {
    const reachable = new Set<string>();
    const visit = (nodeId: string) => {
      if (reachable.has(nodeId)) return;
      reachable.add(nodeId);
      (adjacency.get(nodeId) || []).forEach(visit);
    };
    visit(entry.id);
    graph.nodes.filter((node) => !reachable.has(node.id)).forEach((node) => errors.push(`Node ${node.id} is unreachable from the input node.`));
    if (!outputNodes.some((node) => reachable.has(node.id))) errors.push("No output node is reachable from the input node.");
  }
  graph.nodes.filter((node) => node.kind !== "output" && !graph.edges.some((edge) => edge.from === node.id)).forEach((node) => errors.push(`Node ${node.id} is a dead end.`));
  graph.nodes.filter((node) => node.kind === "guard").forEach((node) => {
    const conditions = new Set(graph.edges.filter((edge) => edge.from === node.id).map((edge) => edge.condition).filter(Boolean));
    if (conditions.size < 2) warnings.push(`Guard node ${node.id} should expose at least two conditional branches.`);
  });
  if (!graph.runtimeProfile) warnings.push("No immutable runtime profile is pinned to this graph version.");
  if (!graph.artifactInputs?.length) warnings.push("No immutable input artifacts are pinned to this graph version.");
  return { valid: errors.length === 0, errors, warnings };
}

export function createProtectedToolResumeGraph(): WorkflowGraph {
  return {
    schemaVersion: WORKFLOW_GRAPH_SCHEMA_VERSION,
    id: "agent-protected-tool-resume",
    version: 1,
    label: "Agent protected tool and resume",
    nodes: [
      { id: "prompt", kind: "input", label: "User prompt", config: {}, sideEffect: "none", resumePolicy: "replay-safe", position: { x: 36, y: 118 } },
      { id: "model", kind: "model", label: "Plan tool call", config: { profile: "active" }, sideEffect: "none", resumePolicy: "replay-safe", position: { x: 228, y: 118 } },
      { id: "approval", kind: "approval", label: "Review protected action", config: { required: true }, sideEffect: "none", resumePolicy: "manual-review", position: { x: 420, y: 118 } },
      { id: "tool", kind: "tool", label: "Execute protected action", config: { protected: true }, sideEffect: "write", resumePolicy: "idempotency-key", position: { x: 612, y: 118 } },
      { id: "verify", kind: "evaluator", label: "Verify tool result", config: {}, sideEffect: "read", resumePolicy: "replay-safe", position: { x: 804, y: 118 } },
      { id: "answer", kind: "output", label: "Final answer", config: {}, sideEffect: "none", resumePolicy: "replay-safe", position: { x: 996, y: 118 } },
    ],
    edges: [
      { from: "prompt", to: "model" },
      { from: "model", to: "approval", condition: "protected_tool_requested" },
      { from: "approval", to: "tool", condition: "approved" },
      { from: "tool", to: "verify" },
      { from: "verify", to: "answer" },
    ],
    runtimeProfile: { id: "agent-balanced", label: "Agent balanced", target: "local-first", model: "active", temperature: 0.2, maxTokens: 2048, contextWindow: 32768, toolMode: "auto" },
    artifactInputs: [{ id: "protected-tool-policy", kind: "tool-policy", digest: "sha256:local-protected-tool-policy-v1" }],
  };
}

export function createRetrievalGroundedAnswerGraph(): WorkflowGraph {
  return {
    schemaVersion: WORKFLOW_GRAPH_SCHEMA_VERSION,
    id: "retrieval-grounded-answer",
    version: 1,
    label: "Retrieval grounded answer",
    nodes: [
      { id: "question", kind: "input", label: "Question", config: {}, sideEffect: "none", resumePolicy: "replay-safe", position: { x: 48, y: 118 } },
      { id: "retrieve", kind: "retrieval", label: "Retrieve ACL-filtered evidence", config: { topK: 8, aclRequired: true }, sideEffect: "read", resumePolicy: "replay-safe", position: { x: 260, y: 118 } },
      { id: "generate", kind: "model", label: "Generate cited answer", config: { citationsRequired: true }, sideEffect: "none", resumePolicy: "replay-safe", position: { x: 472, y: 118 } },
      { id: "verify", kind: "evaluator", label: "Verify citations", config: { minimumCitations: 1 }, sideEffect: "read", resumePolicy: "replay-safe", position: { x: 684, y: 118 } },
      { id: "answer", kind: "output", label: "Grounded answer", config: {}, sideEffect: "none", resumePolicy: "replay-safe", position: { x: 896, y: 118 } },
    ],
    edges: [{ from: "question", to: "retrieve" }, { from: "retrieve", to: "generate" }, { from: "generate", to: "verify" }, { from: "verify", to: "answer" }],
    runtimeProfile: { id: "rag-grounded", label: "RAG grounded", target: "local-first", model: "active", temperature: 0.1, maxTokens: 1536, contextWindow: 32768, toolMode: "off" },
    artifactInputs: [{ id: "enterprise-starter-kb", kind: "knowledge-base", digest: "sha256:enterprise-starter-kb-v1" }],
  };
}

export function readWorkflowGraphFoundation() {
  const protectedToolResumeGraph = createProtectedToolResumeGraph();
  return {
    ok: true as const,
    schemaVersion: WORKFLOW_GRAPH_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    graphs: [{ graph: protectedToolResumeGraph, validation: validateWorkflowGraph(protectedToolResumeGraph) }, { graph: createRetrievalGroundedAnswerGraph(), validation: validateWorkflowGraph(createRetrievalGroundedAnswerGraph()) }],
    capabilities: ["typed-nodes", "guard-node", "strict-validation", "persisted-layout", "runtime-profile", "immutable-artifact-inputs", "side-effect-policy", "resume-policy", "versioned-graph", "breakpoint-store", "editor-contract"],
    blockers: ["Multi-user collaborative editing and distributed worker scheduling remain out of scope for the local safe-worker foundation."],
  };
}
