import { NextResponse } from "next/server";
import { readModelTransferSchedulerEvidence, rehearseModelTransferScheduler } from "@/features/models/transfer-scheduler";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readModelTransferSchedulerEvidence()); }
export async function POST() { const receipt = rehearseModelTransferScheduler(); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readModelTransferSchedulerEvidence() }, { status: receipt.status === "pass" ? 200 : 422 }); }
