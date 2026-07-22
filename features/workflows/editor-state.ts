import {
  WORKFLOW_GRAPH_SCHEMA_VERSION,
  type WorkflowEdge,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowNodeKind,
  type WorkflowNodePosition,
} from "@/features/workflows/graph-contract";

export const WORKFLOW_NODE_PALETTE: Array<{
  kind: WorkflowNodeKind;
  label: string;
  description: string;
  sideEffect: WorkflowNode["sideEffect"];
  resumePolicy: WorkflowNode["resumePolicy"];
}> = [
  { kind: "input", label: "Input", description: "Typed request entry", sideEffect: "none", resumePolicy: "replay-safe" },
  { kind: "model", label: "Model", description: "Profile-pinned inference", sideEffect: "none", resumePolicy: "replay-safe" },
  { kind: "retrieval", label: "Retrieval", description: "ACL-filtered evidence", sideEffect: "read", resumePolicy: "replay-safe" },
  { kind: "tool", label: "Tool", description: "Audited capability call", sideEffect: "write", resumePolicy: "idempotency-key" },
  { kind: "guard", label: "Guard", description: "Conditional policy branch", sideEffect: "none", resumePolicy: "replay-safe" },
  { kind: "approval", label: "Approval", description: "Human protected-action gate", sideEffect: "none", resumePolicy: "manual-review" },
  { kind: "evaluator", label: "Evaluator", description: "Quality or policy check", sideEffect: "read", resumePolicy: "replay-safe" },
  { kind: "output", label: "Output", description: "Typed response exit", sideEffect: "none", resumePolicy: "replay-safe" },
];

function nextNodeId(graph: WorkflowGraph, kind: WorkflowNodeKind) {
  const occupied = new Set(graph.nodes.map((node) => node.id));
  let sequence = 1;
  while (occupied.has(`${kind}-${sequence}`)) sequence += 1;
  return `${kind}-${sequence}`;
}

function nextPosition(graph: WorkflowGraph): WorkflowNodePosition {
  const count = graph.nodes.length;
  return { x: 36 + (count % 5) * 204, y: 54 + Math.floor(count / 5) * 142 };
}

export function createWorkflowNode(graph: WorkflowGraph, kind: WorkflowNodeKind): WorkflowNode {
  const template = WORKFLOW_NODE_PALETTE.find((entry) => entry.kind === kind);
  if (!template) throw new Error(`Unsupported workflow node kind: ${kind}`);
  return {
    id: nextNodeId(graph, kind),
    kind,
    label: template.label,
    config: kind === "guard" ? { expression: "result.ok == true" } : {},
    sideEffect: template.sideEffect,
    resumePolicy: template.resumePolicy,
    position: nextPosition(graph),
  };
}

export function addWorkflowNode(graph: WorkflowGraph, kind: WorkflowNodeKind) {
  const node = createWorkflowNode(graph, kind);
  return { graph: { ...graph, nodes: [...graph.nodes, node] }, node };
}

export function updateWorkflowNode(graph: WorkflowGraph, nodeId: string, patch: Partial<WorkflowNode>): WorkflowGraph {
  if (!graph.nodes.some((node) => node.id === nodeId)) throw new Error(`Workflow node ${nodeId} was not found.`);
  if (patch.id && patch.id !== nodeId && graph.nodes.some((node) => node.id === patch.id)) throw new Error(`Workflow node ${patch.id} already exists.`);
  const nodes = graph.nodes.map((node) => node.id === nodeId ? { ...node, ...patch } : node);
  const edges = patch.id && patch.id !== nodeId
    ? graph.edges.map((edge) => ({ ...edge, from: edge.from === nodeId ? patch.id as string : edge.from, to: edge.to === nodeId ? patch.id as string : edge.to }))
    : graph.edges;
  return { ...graph, nodes, edges };
}

export function removeWorkflowNode(graph: WorkflowGraph, nodeId: string): WorkflowGraph {
  return { ...graph, nodes: graph.nodes.filter((node) => node.id !== nodeId), edges: graph.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId) };
}

export function moveWorkflowNode(graph: WorkflowGraph, nodeId: string, position: WorkflowNodePosition): WorkflowGraph {
  return updateWorkflowNode(graph, nodeId, { position: { x: Math.max(12, Math.round(position.x)), y: Math.max(12, Math.round(position.y)) } });
}

export function addWorkflowEdge(graph: WorkflowGraph, edge: WorkflowEdge): WorkflowGraph {
  if (!graph.nodes.some((node) => node.id === edge.from) || !graph.nodes.some((node) => node.id === edge.to)) throw new Error("Both workflow edge nodes must exist.");
  if (graph.edges.some((candidate) => candidate.from === edge.from && candidate.to === edge.to && (candidate.condition || "") === (edge.condition || ""))) throw new Error("Workflow edge already exists.");
  return { ...graph, edges: [...graph.edges, { ...edge, condition: edge.condition?.trim() || undefined }] };
}

export function removeWorkflowEdge(graph: WorkflowGraph, edge: WorkflowEdge): WorkflowGraph {
  return { ...graph, edges: graph.edges.filter((candidate) => !(candidate.from === edge.from && candidate.to === edge.to && (candidate.condition || "") === (edge.condition || ""))) };
}

export function createWorkflowDraft(source: WorkflowGraph, version: number): WorkflowGraph {
  return {
    ...source,
    schemaVersion: WORKFLOW_GRAPH_SCHEMA_VERSION,
    version,
    label: `${source.label.replace(/ v\d+$/, "")} v${version}`,
    nodes: source.nodes.map((node) => ({ ...node, config: { ...node.config }, position: node.position ? { ...node.position } : undefined })),
    edges: source.edges.map((edge) => ({ ...edge })),
    runtimeProfile: source.runtimeProfile ? { ...source.runtimeProfile } : undefined,
    artifactInputs: source.artifactInputs?.map((artifact) => ({ ...artifact })),
  };
}
