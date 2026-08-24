import { NextResponse } from "next/server";

import {
  readQualityPolicySafetyReviewEvidence,
  runQualityPolicySafetyRehearsal,
} from "@/features/evaluation/quality-policy-safety-review";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readQualityPolicySafetyReviewEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const result = runQualityPolicySafetyRehearsal();
    return NextResponse.json(
      {
        ok: result.receipt.localStatus === "pass",
        ...result,
        evidence: readQualityPolicySafetyReviewEvidence(),
      },
      { status: result.receipt.localStatus === "pass" ? 200 : 422 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Quality policy safety rehearsal failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
