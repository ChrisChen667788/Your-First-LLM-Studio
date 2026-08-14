import { runProviderCompletion } from "@/features/providers/provider-port";
import { getServerAgentTarget } from "@/lib/agent/server-targets";
import type { WorkflowExecutionState } from "@/features/workflows/execution-reducer";
import type {
  WorkflowGraph,
  WorkflowNode,
} from "@/features/workflows/graph-contract";
import { buildWorkflowUpstreamContext } from "@/features/workflows/node-execution-contract";

export const WORKFLOW_MODEL_PROVIDER_PORT_SCHEMA_VERSION =
  "workflows.model-provider-port.v1" as const;

function resolveWorkflowTargetId(graph: WorkflowGraph, node: WorkflowNode) {
  const configured =
    (typeof node.config.targetId === "string" && node.config.targetId.trim()) ||
    graph.runtimeProfile?.target ||
    "";
  if (configured && getServerAgentTarget(configured)) return configured;
  const fallback =
    process.env.WORKFLOW_DEFAULT_TARGET_ID || "local-qwen3-0.6b";
  if (!getServerAgentTarget(fallback)) {
    throw new Error(`Workflow model target is unavailable: ${fallback}`);
  }
  return fallback;
}

function renderPrompt(
  template: string,
  state: WorkflowExecutionState,
  graph: WorkflowGraph,
) {
  const upstreamContext = buildWorkflowUpstreamContext(state, graph);
  const rendered = template
    .replaceAll("{{input}}", state.input)
    .replaceAll("{{executionId}}", state.id)
    .replaceAll("{{upstreamContext}}", upstreamContext);
  if (!upstreamContext || template.includes("{{upstreamContext}}")) return rendered;
  return `${rendered}\n\nVerified upstream node evidence:\n${upstreamContext}`;
}

export async function executeWorkflowModelNode(input: {
  graph: WorkflowGraph;
  node: WorkflowNode;
  state: WorkflowExecutionState;
}) {
  const targetId = resolveWorkflowTargetId(input.graph, input.node);
  const promptTemplate =
    typeof input.node.config.prompt === "string"
      ? input.node.config.prompt
      : "Complete this workflow task and return the result only:\n\n{{input}}";
  const systemPrompt =
    typeof input.node.config.systemPrompt === "string"
      ? input.node.config.systemPrompt
      : "You are a workflow model node. Produce a concise, executable result and do not claim that tools ran unless the workflow supplies tool evidence.";
  const profile = input.graph.runtimeProfile;
  const response = await runProviderCompletion({
    targetId,
    input: renderPrompt(promptTemplate, input.state, input.graph),
    systemPrompt,
    contextWindow: profile?.contextWindow,
    maxTokens: profile?.maxTokens,
    temperature: profile?.temperature,
    providerProfile: profile?.toolMode === "required" ? "tool-first" : "balanced",
    thinkingMode: "standard",
    operation: `workflow-model:${input.graph.id}:${input.node.id}`,
  });
  if (!response.content.trim()) {
    throw new Error(`Workflow model node ${input.node.id} returned no content.`);
  }
  return {
    output: response.content.trim(),
    targetId,
    resolvedModel: response.resolvedModel,
    usage: response.usage || null,
    warning: response.warning,
  };
}
