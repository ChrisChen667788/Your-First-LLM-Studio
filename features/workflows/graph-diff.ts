import type { WorkflowGraph } from "@/features/workflows/graph-contract";

export type WorkflowGraphVersionDiff = {
  from: { id: string; version: number };
  to: { id: string; version: number };
  nodes: { added: string[]; removed: string[]; changed: string[] };
  edges: { added: string[]; removed: string[] };
  runtimeProfileChanged: boolean;
  artifactInputsChanged: boolean;
};

function stable(value: unknown) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === "object") return JSON.stringify(Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))));
  return JSON.stringify(value);
}

function edgeKey(edge: WorkflowGraph["edges"][number]) {
  return `${edge.from}->${edge.to}${edge.condition ? ` [${edge.condition}]` : ""}`;
}

export function diffWorkflowGraphs(from: WorkflowGraph, to: WorkflowGraph): WorkflowGraphVersionDiff {
  const fromNodes = new Map(from.nodes.map((node) => [node.id, node]));
  const toNodes = new Map(to.nodes.map((node) => [node.id, node]));
  const fromEdges = new Set(from.edges.map(edgeKey));
  const toEdges = new Set(to.edges.map(edgeKey));
  return {
    from: { id: from.id, version: from.version },
    to: { id: to.id, version: to.version },
    nodes: {
      added: [...toNodes.keys()].filter((id) => !fromNodes.has(id)),
      removed: [...fromNodes.keys()].filter((id) => !toNodes.has(id)),
      changed: [...toNodes.keys()].filter((id) => fromNodes.has(id) && stable(fromNodes.get(id)) !== stable(toNodes.get(id))),
    },
    edges: { added: [...toEdges].filter((edge) => !fromEdges.has(edge)), removed: [...fromEdges].filter((edge) => !toEdges.has(edge)) },
    runtimeProfileChanged: stable(from.runtimeProfile) !== stable(to.runtimeProfile),
    artifactInputsChanged: stable(from.artifactInputs) !== stable(to.artifactInputs),
  };
}
