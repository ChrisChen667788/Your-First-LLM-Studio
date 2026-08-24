import { NextResponse } from "next/server";
import { readV171V190SourceTrainEvidence, runV171V190SourceTrainAcceptance } from "@/features/experiments/v171-v190-source-train";
import { assertTrustedOperatorRequest, operatorAuthorizationStatus } from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() { return NextResponse.json(readV171V190SourceTrainEvidence()); }

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = runV171V190SourceTrainAcceptance();
    return NextResponse.json({ ok: receipt.localStatus === "pass", receipt, evidence: readV171V190SourceTrainEvidence() }, { status: receipt.localStatus === "pass" ? 200 : 422 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Source train acceptance failed." }, { status: operatorAuthorizationStatus(error) });
  }
}
