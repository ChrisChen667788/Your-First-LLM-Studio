import { NextResponse } from "next/server";
import { readWorkflowGraphFoundation, validateWorkflowGraph } from "@/features/workflows/graph-contract";
import {
  createPersistedWorkflowExecution,
  dispatchPersistedWorkflowEvent,
  readWorkflowExecutions,
  type WorkflowExecutionEvent,
} from "@/features/workflows/execution-reducer";
import { readWorkflowBreakpoints, setWorkflowBreakpoint } from "@/features/workflows/breakpoint-store";
import { cloneWorkflowVersion, publishWorkflowVersion, readWorkflowGraphRegistry, resolveWorkflowGraph, retireWorkflowVersion, saveWorkflowDraft } from "@/features/workflows/graph-registry";
import type { WorkflowGraph } from "@/features/workflows/graph-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ...readWorkflowGraphFoundation(), graphRegistry: readWorkflowGraphRegistry(), executionStore: readWorkflowExecutions(), breakpointStore: readWorkflowBreakpoints() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      input?: string;
      executionId?: string;
      event?: Omit<WorkflowExecutionEvent, "id" | "at"> & { id?: string; at?: string };
      graphId?: string;
      graphVersion?: number;
      nodeId?: string;
      enabled?: boolean;
      graph?: WorkflowGraph;
      deploymentSlug?: string;
      expectedRevision?: number;
      nextVersion?: number;
    };
    if (body.action === "breakpoint") {
      const breakpoint = setWorkflowBreakpoint({
        graphId: typeof body.graphId === "string" ? body.graphId : "agent-protected-tool-resume",
        graphVersion: typeof body.graphVersion === "number" ? body.graphVersion : 1,
        nodeId: typeof body.nodeId === "string" ? body.nodeId : "",
        enabled: body.enabled !== false,
      });
      return NextResponse.json({ ok: true, breakpoint, breakpointStore: readWorkflowBreakpoints() });
    }
    if (body.action === "save-draft") {
      if (!body.graph) throw new Error("graph is required.");
      return NextResponse.json({ ok: true, record: saveWorkflowDraft(body.graph, { expectedRevision: body.expectedRevision }), graphRegistry: readWorkflowGraphRegistry() });
    }
    if (body.action === "validate") {
      if (!body.graph) throw new Error("graph is required.");
      const validation = validateWorkflowGraph(body.graph);
      return NextResponse.json({ ok: validation.valid, validation }, { status: validation.valid ? 200 : 422 });
    }
    if (body.action === "clone-version") {
      const record = cloneWorkflowVersion({ graphId: body.graphId || "", graphVersion: body.graphVersion || 0, nextVersion: body.nextVersion });
      return NextResponse.json({ ok: true, record, graphRegistry: readWorkflowGraphRegistry() });
    }
    if (body.action === "publish") {
      const record = publishWorkflowVersion({ graphId: body.graphId || "", graphVersion: body.graphVersion || 0, deploymentSlug: body.deploymentSlug || "", expectedRevision: body.expectedRevision });
      return NextResponse.json({ ok: true, record, graphRegistry: readWorkflowGraphRegistry() });
    }
    if (body.action === "retire") {
      const record = retireWorkflowVersion({ graphId: body.graphId || "", graphVersion: body.graphVersion || 0, expectedRevision: body.expectedRevision });
      return NextResponse.json({ ok: true, record, graphRegistry: readWorkflowGraphRegistry() });
    }
    const selectedGraph = body.graphId && body.graphVersion ? resolveWorkflowGraph(body.graphId, body.graphVersion) : null;
    if (body.action !== "dispatch" && body.graphId && body.graphVersion && !selectedGraph) throw new Error("Selected workflow graph version was not found.");
    const execution = body.action === "dispatch"
      ? dispatchPersistedWorkflowEvent(body.executionId || "", body.event || { type: "start" })
      : createPersistedWorkflowExecution(body.input || "", selectedGraph || undefined);
    return NextResponse.json({ ok: true, execution, executionStore: readWorkflowExecutions() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Workflow execution failed." }, { status: 400 });
  }
}
