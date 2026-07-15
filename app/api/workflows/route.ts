import { NextResponse } from "next/server";
import { readWorkflowGraphFoundation } from "@/features/workflows/graph-contract";
import {
  createPersistedWorkflowExecution,
  dispatchPersistedWorkflowEvent,
  readWorkflowExecutions,
  type WorkflowExecutionEvent,
} from "@/features/workflows/execution-reducer";
import { readWorkflowBreakpoints, setWorkflowBreakpoint } from "@/features/workflows/breakpoint-store";
import { publishWorkflowVersion, readWorkflowGraphRegistry, saveWorkflowDraft } from "@/features/workflows/graph-registry";
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
      return NextResponse.json({ ok: true, record: saveWorkflowDraft(body.graph), graphRegistry: readWorkflowGraphRegistry() });
    }
    if (body.action === "publish") {
      const record = publishWorkflowVersion({ graphId: body.graphId || "", graphVersion: body.graphVersion || 0, deploymentSlug: body.deploymentSlug || "" });
      return NextResponse.json({ ok: true, record, graphRegistry: readWorkflowGraphRegistry() });
    }
    const execution = body.action === "dispatch"
      ? dispatchPersistedWorkflowEvent(body.executionId || "", body.event || { type: "start" })
      : createPersistedWorkflowExecution(body.input || "");
    return NextResponse.json({ ok: true, execution, executionStore: readWorkflowExecutions() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Workflow execution failed." }, { status: 400 });
  }
}
