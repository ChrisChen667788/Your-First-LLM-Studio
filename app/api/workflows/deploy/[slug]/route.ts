import { NextResponse } from "next/server";
import { createPersistedWorkflowExecution, dispatchPersistedWorkflowEvent } from "@/features/workflows/execution-reducer";
import { resolveDeployedWorkflow } from "@/features/workflows/graph-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const deployment = resolveDeployedWorkflow(slug);
  if (!deployment) return NextResponse.json({ ok: false, error: "Workflow deployment was not found." }, { status: 404 });
  return NextResponse.json({ ok: true, slug, graphId: deployment.graph.id, graphVersion: deployment.graph.version, inputSchema: { type: "object", required: ["input"], properties: { input: { type: "string" } } }, executionMode: "durable-step-worker" });
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const deployment = resolveDeployedWorkflow(slug);
  if (!deployment) return NextResponse.json({ ok: false, error: "Workflow deployment was not found." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { input?: string };
  if (!body.input?.trim()) return NextResponse.json({ ok: false, error: "input is required." }, { status: 400 });
  let execution = createPersistedWorkflowExecution(body.input, deployment.graph);
  execution = dispatchPersistedWorkflowEvent(execution.id, { type: "start" });
  return NextResponse.json({ ok: true, accepted: true, deployment: slug, execution }, { status: 202 });
}
