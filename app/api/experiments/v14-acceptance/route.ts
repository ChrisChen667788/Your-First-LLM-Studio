import { NextResponse } from "next/server";

import {
  readV14AcceptanceBatchEvidence,
  runV14AcceptanceBatch,
} from "@/features/experiments/v14-acceptance-batch";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readV14AcceptanceBatchEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = runV14AcceptanceBatch();
    return NextResponse.json(
      { ok: receipt.localStatus === "pass", receipt, evidence: readV14AcceptanceBatchEvidence() },
      { status: receipt.localStatus === "pass" ? 200 : 422 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "v1.4 acceptance failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
