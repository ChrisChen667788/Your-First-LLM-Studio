import { NextResponse } from "next/server";
import {
  authorizeWorkflowHttpRequest,
  buildOpenAIWorkflowCompletion,
  buildOpenAIWorkflowStream,
  executeDeployedWorkflowCompletion,
  WorkflowCompletionBoundaryError,
  WorkflowDeploymentAuthorizationError,
  workflowDeploymentErrorStatus,
  type WorkflowInvocationBody,
} from "@/features/workflows/deployment-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const body = (await request.json().catch(() => ({}))) as WorkflowInvocationBody;
    authorizeWorkflowHttpRequest(request, slug);
    const result = await executeDeployedWorkflowCompletion(slug, body);
    if (body.stream) {
      return new Response(
        buildOpenAIWorkflowStream(slug, result.execution, body.stream_options?.include_usage === true),
        {
          status: 200,
          headers: {
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "Content-Type": "text/event-stream; charset=utf-8",
          },
        },
      );
    }
    return NextResponse.json(buildOpenAIWorkflowCompletion(slug, result.execution));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workflow invocation failed.";
    const boundary = error instanceof WorkflowCompletionBoundaryError ? error : null;
    const authorization = error instanceof WorkflowDeploymentAuthorizationError;
    return NextResponse.json(
      {
        error: {
          message,
          type: authorization ? "authentication_error" : boundary ? "workflow_resume_required" : "invalid_request_error",
          code: authorization ? "invalid_api_key" : boundary ? "workflow_requires_resume" : "workflow_invocation_failed",
        },
        ...(boundary
          ? {
              workflow: {
                executionId: boundary.execution.id,
                status: boundary.execution.status,
                outcome: boundary.outcome,
                resumeReason: boundary.execution.error || null,
              },
            }
          : {}),
      },
      {
        status: workflowDeploymentErrorStatus(error),
        headers: authorization ? { "WWW-Authenticate": "Bearer" } : undefined,
      },
    );
  }
}
