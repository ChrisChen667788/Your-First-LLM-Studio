import { NextResponse } from "next/server";

import {
  readCompetitiveProductTrainEvidence,
  runCompetitiveProductTrainAcceptance,
} from "@/features/experiments/competitive-product-train";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readCompetitiveProductTrainEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = runCompetitiveProductTrainAcceptance();
    return NextResponse.json(
      { ok: receipt.localStatus === "pass", receipt, evidence: readCompetitiveProductTrainEvidence() },
      { status: receipt.localStatus === "pass" ? 200 : 422 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Competitive product train acceptance failed." },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
