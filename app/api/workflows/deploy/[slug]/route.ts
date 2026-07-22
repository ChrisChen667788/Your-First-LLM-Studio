import { NextResponse } from "next/server";
import { authorizeWorkflowHttpRequest, buildWorkflowDeploymentExamples, invokeDeployedWorkflow, type WorkflowInvocationBody } from "@/features/workflows/deployment-application";
import { resolveDeployedWorkflow } from "@/features/workflows/graph-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const deployment = resolveDeployedWorkflow(slug);
  if (!deployment) return NextResponse.json({ ok: false, error: "Workflow deployment was not found." }, { status: 404 });
  return NextResponse.json({ ok: true, slug, graphId: deployment.graph.id, graphVersion: deployment.graph.version, graphDigest: deployment.graphDigest, inputSchema: { type: "object", required: ["input"], properties: { input: { type: "string" } } }, openAICompatibleEndpoint: `/api/workflows/deploy/${slug}/v1/chat/completions`, examples: buildWorkflowDeploymentExamples({ origin: new URL(request.url).origin, slug }), executionMode: "durable-step-worker" });
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const deployment = resolveDeployedWorkflow(slug);
  if (!deployment) return NextResponse.json({ ok: false, error: "Workflow deployment was not found." }, { status: 404 });
  try {
    const body = await request.json().catch(() => ({})) as WorkflowInvocationBody;
    authorizeWorkflowHttpRequest(request, slug);
    const result = invokeDeployedWorkflow(slug, body);
    return NextResponse.json({ ok: true, accepted: true, deployment: slug, graphDigest: result.deployment.graphDigest, execution: result.execution }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workflow invocation failed.";
    return NextResponse.json({ ok: false, error: message }, { status: message.startsWith("Unauthorized") ? 401 : 400 });
  }
}
