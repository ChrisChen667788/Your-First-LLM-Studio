import { NextResponse } from "next/server";
import { readWorkflowStudioAcceptanceEvidence, rehearseWorkflowStudioAcceptance } from "@/features/workflows/studio-acceptance";
import { assertTrustedOperatorRequest, operatorAuthorizationStatus } from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readWorkflowStudioAcceptanceEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = await rehearseWorkflowStudioAcceptance();
    return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readWorkflowStudioAcceptanceEvidence() }, { status: receipt.status === "pass" ? 200 : 422 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Workflow acceptance failed." }, { status: operatorAuthorizationStatus(error) });
  }
}
