import { NextResponse } from "next/server";
import { forkWorkflowExecutionForReplay, readWorkflowReplayEvidence } from "@/features/workflows/replay-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readWorkflowReplayEvidence()); }
export async function POST(request: Request) { try { const body = await request.json().catch(() => ({})) as { sourceExecutionId?: string; inputOverride?: string }; if (!body.sourceExecutionId) throw new Error("sourceExecutionId is required."); const result = forkWorkflowExecutionForReplay({ sourceExecutionId: body.sourceExecutionId, inputOverride: body.inputOverride }); return NextResponse.json({ ok: true, ...result, evidence: readWorkflowReplayEvidence() }); } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Workflow replay failed." }, { status: 400 }); } }
