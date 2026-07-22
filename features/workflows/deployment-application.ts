import { createPersistedWorkflowExecution, dispatchPersistedWorkflowEvent } from "@/features/workflows/execution-reducer";
import { authorizeWorkflowDeployment } from "@/features/workflows/deployment-access";
import { resolveDeployedWorkflow } from "@/features/workflows/graph-registry";

export type OpenAIWorkflowMessage = { role: "system" | "user" | "assistant" | "tool"; content: string };
export type WorkflowInvocationBody = { input?: string; model?: string; messages?: OpenAIWorkflowMessage[]; stream?: boolean };

export function authorizeWorkflowHttpRequest(request: Request, slug: string) {
  const deployment = resolveDeployedWorkflow(slug);
  if (!deployment) throw new Error("Workflow deployment was not found.");
  const hostname = new URL(request.url).hostname;
  const localLoopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (!token && localLoopback) return { mode: "loopback-bypass" as const, deployment };
  if (!token || !authorizeWorkflowDeployment({ token, workflowSlug: slug, version: deployment.graph.version, scope: "invoke" })) {
    throw new Error("Unauthorized workflow deployment request.");
  }
  return { mode: "deployment-key" as const, deployment };
}

export function normalizeWorkflowInvocation(body: WorkflowInvocationBody) {
  if (body.stream) throw new Error("Workflow streaming is not available yet; submit a durable non-streaming invocation.");
  const input = body.input?.trim() || [...(body.messages || [])].reverse().find((message) => message.role === "user")?.content.trim();
  if (!input) throw new Error("input or a user message is required.");
  return { input, requestedModel: body.model?.trim() || null, openAICompatible: Boolean(body.messages?.length) };
}

export function invokeDeployedWorkflow(slug: string, body: WorkflowInvocationBody) {
  const deployment = resolveDeployedWorkflow(slug);
  if (!deployment) throw new Error("Workflow deployment was not found.");
  const invocation = normalizeWorkflowInvocation(body);
  if (invocation.requestedModel && invocation.requestedModel !== slug && invocation.requestedModel !== `workflow:${slug}`) {
    throw new Error(`Requested model must be workflow:${slug}.`);
  }
  let execution = createPersistedWorkflowExecution(invocation.input, deployment.graph);
  execution = dispatchPersistedWorkflowEvent(execution.id, { type: "start" });
  return { deployment, execution, invocation };
}

export function buildOpenAIWorkflowAcceptance(slug: string, executionId: string) {
  return {
    id: executionId,
    object: "chat.completion" as const,
    created: Math.floor(Date.now() / 1000),
    model: `workflow:${slug}`,
    choices: [{ index: 0, message: { role: "assistant" as const, content: `Workflow accepted. Track durable execution ${executionId}.` }, finish_reason: "workflow_accepted" }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    workflow: { executionId, status: "accepted" as const },
  };
}

export function buildWorkflowDeploymentExamples(input: { origin: string; slug: string; tokenPlaceholder?: string }) {
  const endpoint = `${input.origin.replace(/\/$/, "")}/api/workflows/deploy/${input.slug}/v1/chat/completions`;
  const token = input.tokenPlaceholder || "$WORKFLOW_API_KEY";
  return {
    endpoint,
    curl: `curl ${endpoint} \\\n+  -H "Authorization: Bearer ${token}" \\\n+  -H "Content-Type: application/json" \\\n+  -d '{"model":"workflow:${input.slug}","messages":[{"role":"user","content":"Run this workflow"}]}'`,
    javascript: `const client = new OpenAI({ baseURL: "${endpoint.replace(/\/chat\/completions$/, "")}", apiKey: process.env.WORKFLOW_API_KEY });\nconst result = await client.chat.completions.create({ model: "workflow:${input.slug}", messages: [{ role: "user", content: "Run this workflow" }] });`,
    python: `client = OpenAI(base_url="${endpoint.replace(/\/chat\/completions$/, "")}", api_key=os.environ["WORKFLOW_API_KEY"])\nresult = client.chat.completions.create(model="workflow:${input.slug}", messages=[{"role": "user", "content": "Run this workflow"}])`,
  };
}
