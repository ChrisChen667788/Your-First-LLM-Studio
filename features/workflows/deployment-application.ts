import { authorizeWorkflowDeployment } from "@/features/workflows/deployment-access";
import {
  createPersistedWorkflowExecution,
  dispatchPersistedWorkflowEvent,
  type WorkflowExecutionState,
} from "@/features/workflows/execution-reducer";
import { resolveDeployedWorkflow } from "@/features/workflows/graph-registry";
import { runWorkflowSafeWorker } from "@/features/workflows/worker-service";

export type OpenAIWorkflowMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type WorkflowInvocationBody = {
  input?: string;
  model?: string;
  messages?: OpenAIWorkflowMessage[];
  stream?: boolean;
  stream_options?: { include_usage?: boolean };
};

export class WorkflowDeploymentAuthorizationError extends Error {
  readonly status = 401;

  constructor(message = "A valid workflow deployment key is required.") {
    super(message);
    this.name = "WorkflowDeploymentAuthorizationError";
  }
}

export class WorkflowCompletionBoundaryError extends Error {
  readonly status = 409;

  constructor(
    readonly execution: WorkflowExecutionState,
    readonly outcome: string,
  ) {
    super(`Workflow requires durable resume because execution stopped at ${outcome}.`);
    this.name = "WorkflowCompletionBoundaryError";
  }
}

function deploymentNotFoundError() {
  return Object.assign(new Error("Workflow deployment was not found."), { status: 404 });
}

function estimatedTokens(value: string) {
  return Math.max(1, Math.ceil(value.trim().length / 4));
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
}

export function authorizeWorkflowHttpRequest(request: Request, slug: string) {
  const deployment = resolveDeployedWorkflow(slug);
  if (!deployment) throw deploymentNotFoundError();
  const token = bearerToken(request);
  if (
    !token ||
    !authorizeWorkflowDeployment({
      token,
      workflowSlug: slug,
      version: deployment.graph.version,
      scope: "invoke",
    })
  ) {
    throw new WorkflowDeploymentAuthorizationError();
  }
  return { mode: "deployment-key" as const, deployment };
}

export function normalizeWorkflowInvocation(body: WorkflowInvocationBody) {
  const input =
    body.input?.trim() ||
    [...(body.messages || [])]
      .reverse()
      .find((message) => message.role === "user")
      ?.content.trim();
  if (!input) throw new Error("input or a user message is required.");
  return {
    input,
    requestedModel: body.model?.trim() || null,
    openAICompatible: Boolean(body.messages?.length),
    stream: body.stream === true,
    includeStreamUsage: body.stream_options?.include_usage === true,
  };
}

export function invokeDeployedWorkflow(slug: string, body: WorkflowInvocationBody) {
  const deployment = resolveDeployedWorkflow(slug);
  if (!deployment) throw deploymentNotFoundError();
  const invocation = normalizeWorkflowInvocation(body);
  if (
    invocation.requestedModel &&
    invocation.requestedModel !== slug &&
    invocation.requestedModel !== `workflow:${slug}`
  ) {
    throw new Error(`Requested model must be workflow:${slug}.`);
  }
  let execution = createPersistedWorkflowExecution(invocation.input, deployment.graph);
  execution = dispatchPersistedWorkflowEvent(execution.id, { type: "start" });
  return { deployment, execution, invocation };
}

export async function executeDeployedWorkflowCompletion(slug: string, body: WorkflowInvocationBody) {
  const invocation = invokeDeployedWorkflow(slug, body);
  const worker = await runWorkflowSafeWorker({
    executionId: invocation.execution.id,
    workerId: `openai-compatible-${process.pid}`,
    maxSteps: 50,
  });
  if (!worker.execution) throw new Error("Workflow execution disappeared before completion.");
  if (worker.execution.status !== "completed") {
    throw new WorkflowCompletionBoundaryError(worker.execution, worker.receipt.outcome);
  }
  return { ...invocation, execution: worker.execution, receipt: worker.receipt };
}

export function buildOpenAIWorkflowCompletion(slug: string, execution: WorkflowExecutionState) {
  if (execution.status !== "completed") {
    throw new WorkflowCompletionBoundaryError(execution, execution.status);
  }
  const content = execution.output || "Workflow completed without a textual output.";
  const promptTokens = estimatedTokens(execution.input);
  const completionTokens = estimatedTokens(content);
  return {
    id: execution.id,
    object: "chat.completion" as const,
    created: Math.floor(Date.parse(execution.updatedAt) / 1000),
    model: `workflow:${slug}`,
    choices: [
      {
        index: 0,
        message: { role: "assistant" as const, content },
        finish_reason: "stop" as const,
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
    workflow: {
      executionId: execution.id,
      status: execution.status,
      graphId: execution.graphId,
      graphVersion: execution.graphVersion,
      tokenAccounting: "estimated" as const,
    },
  };
}

export function buildOpenAIWorkflowStream(
  slug: string,
  execution: WorkflowExecutionState,
  includeUsage = false,
) {
  const completion = buildOpenAIWorkflowCompletion(slug, execution);
  const base = {
    id: completion.id,
    object: "chat.completion.chunk" as const,
    created: completion.created,
    model: completion.model,
  };
  const chunks = [
    { ...base, choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }] },
    { ...base, choices: [{ index: 0, delta: { content: completion.choices[0].message.content }, finish_reason: null }] },
    { ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
  ];
  if (includeUsage) chunks.push({ ...base, choices: [], usage: completion.usage } as (typeof chunks)[number]);
  return `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`;
}

export function workflowDeploymentErrorStatus(error: unknown) {
  if (error instanceof WorkflowDeploymentAuthorizationError) return error.status;
  if (error instanceof WorkflowCompletionBoundaryError) return error.status;
  if (error && typeof error === "object" && "status" in error && typeof error.status === "number") {
    return error.status;
  }
  return 400;
}

export function buildWorkflowDeploymentExamples(input: {
  origin: string;
  slug: string;
  tokenPlaceholder?: string;
}) {
  const endpoint = `${input.origin.replace(/\/$/, "")}/api/workflows/deploy/${input.slug}/v1/chat/completions`;
  const token = input.tokenPlaceholder || "$WORKFLOW_API_KEY";
  return {
    endpoint,
    curl: `curl ${endpoint} \\\n+  -H "Authorization: Bearer ${token}" \\\n+  -H "Content-Type: application/json" \\\n+  -d '{"model":"workflow:${input.slug}","messages":[{"role":"user","content":"Run this workflow"}]}'`,
    javascript: `const client = new OpenAI({ baseURL: "${endpoint.replace(/\/chat\/completions$/, "")}", apiKey: process.env.WORKFLOW_API_KEY });\nconst result = await client.chat.completions.create({ model: "workflow:${input.slug}", messages: [{ role: "user", content: "Run this workflow" }] });`,
    python: `client = OpenAI(base_url="${endpoint.replace(/\/chat\/completions$/, "")}", api_key=os.environ["WORKFLOW_API_KEY"])\nresult = client.chat.completions.create(model="workflow:${input.slug}", messages=[{"role": "user", "content": "Run this workflow"}])`,
  };
}
