import { NextResponse } from "next/server";
import { readWorkflowWorkerEvidence, runWorkflowSafeWorker } from "@/features/workflows/worker-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readWorkflowWorkerEvidence()); }
export async function POST(request: Request) { try { const body = await request.json().catch(() => ({})) as { executionId?: string; workerId?: string; maxSteps?: number }; if (!body.executionId) throw new Error("executionId is required."); const result = runWorkflowSafeWorker({ executionId: body.executionId, workerId: body.workerId, maxSteps: body.maxSteps }); return NextResponse.json({ ok: result.receipt.status === "pass", ...result, evidence: readWorkflowWorkerEvidence() }, { status: result.receipt.status === "pass" ? 200 : 422 }); } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Workflow worker failed." }, { status: 400 }); } }
