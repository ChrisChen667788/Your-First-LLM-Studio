import { NextResponse } from "next/server";
import { authorizeWorkflowHttpRequest, buildOpenAIWorkflowAcceptance, invokeDeployedWorkflow, type WorkflowInvocationBody } from "@/features/workflows/deployment-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const body = await request.json().catch(() => ({})) as WorkflowInvocationBody;
    authorizeWorkflowHttpRequest(request, slug);
    const result = invokeDeployedWorkflow(slug, body);
    return NextResponse.json(buildOpenAIWorkflowAcceptance(slug, result.execution.id), { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workflow invocation failed.";
    return NextResponse.json({ error: { message, type: "invalid_request_error", code: "workflow_invocation_failed" } }, { status: message.includes("not found") ? 404 : message.startsWith("Unauthorized") ? 401 : 400 });
  }
}
