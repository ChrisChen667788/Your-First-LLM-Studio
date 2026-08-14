import { NextResponse } from "next/server";

import {
  readV163BenchmarkQualificationEvidence,
  runV163BenchmarkQualificationAcceptance,
} from "@/features/experiments/v163-benchmark-qualification";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readV163BenchmarkQualificationEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = await runV163BenchmarkQualificationAcceptance();
    return NextResponse.json(
      {
        ok: receipt.localStatus === "pass",
        receipt,
        evidence: readV163BenchmarkQualificationEvidence(),
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
            : "v1.6.3 benchmark qualification acceptance failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
