import { NextResponse } from "next/server";

import {
  readReleaseCandidateAcceptanceEvidence,
  runReleaseCandidateAcceptance,
} from "@/features/evaluation/release-candidate-acceptance";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readReleaseCandidateAcceptanceEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = runReleaseCandidateAcceptance();
    return NextResponse.json(
      {
        ok: receipt.localStatus === "pass",
        receipt,
        evidence: readReleaseCandidateAcceptanceEvidence(),
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
            : "Release-candidate acceptance failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
