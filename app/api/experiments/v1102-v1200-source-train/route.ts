import { NextResponse } from "next/server";

import {
  readV1102V1200SourceTrainEvidence,
  runV1102V1200SourceTrainAcceptance,
} from "@/features/experiments/v1102-v1200-source-train";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readV1102V1200SourceTrainEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = runV1102V1200SourceTrainAcceptance();
    return NextResponse.json(
      {
        ok: receipt.localStatus === "pass",
        receipt,
        evidence: readV1102V1200SourceTrainEvidence(),
      },
      { status: receipt.localStatus === "pass" ? 200 : 422 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Future source train acceptance failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
