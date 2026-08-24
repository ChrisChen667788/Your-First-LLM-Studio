import { NextResponse } from "next/server";

import {
  readV170BenchmarkCandidateMultimodalEvidence,
  runV170BenchmarkCandidateMultimodalAcceptance,
} from "@/features/experiments/v170-benchmark-candidate-multimodal";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readV170BenchmarkCandidateMultimodalEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = runV170BenchmarkCandidateMultimodalAcceptance();
    return NextResponse.json(
      {
        ok: receipt.localStatus === "pass",
        receipt,
        evidence: readV170BenchmarkCandidateMultimodalEvidence(),
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
            : "v1.7.0 candidate and multimodal acceptance failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
