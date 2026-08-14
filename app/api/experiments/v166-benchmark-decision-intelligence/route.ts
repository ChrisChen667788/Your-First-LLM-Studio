import { NextResponse } from "next/server";

import {
  readV166BenchmarkDecisionEvidence,
  runV166BenchmarkDecisionAcceptance,
} from "@/features/experiments/v166-benchmark-decision-intelligence";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readV166BenchmarkDecisionEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = runV166BenchmarkDecisionAcceptance();
    return NextResponse.json(
      {
        ok: receipt.localStatus === "pass",
        receipt,
        evidence: readV166BenchmarkDecisionEvidence(),
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
            : "v1.6.6 benchmark decision acceptance failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
