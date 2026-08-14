import { NextResponse } from "next/server";

import {
  readV165BenchmarkReproducibilityEvidence,
  runV165BenchmarkReproducibilityAcceptance,
} from "@/features/experiments/v165-benchmark-reproducibility";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readV165BenchmarkReproducibilityEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = await runV165BenchmarkReproducibilityAcceptance();
    return NextResponse.json(
      {
        ok: receipt.localStatus === "pass",
        receipt,
        evidence: readV165BenchmarkReproducibilityEvidence(),
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
            : "v1.6.5 reproducibility acceptance failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
