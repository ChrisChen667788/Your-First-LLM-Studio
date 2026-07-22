import { NextResponse } from "next/server";
import { readWorkflowStudioAcceptanceEvidence, rehearseWorkflowStudioAcceptance } from "@/features/workflows/studio-acceptance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readWorkflowStudioAcceptanceEvidence());
}

export async function POST() {
  const receipt = rehearseWorkflowStudioAcceptance();
  return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readWorkflowStudioAcceptanceEvidence() }, { status: receipt.status === "pass" ? 200 : 422 });
}
