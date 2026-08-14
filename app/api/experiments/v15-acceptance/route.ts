import { NextResponse } from "next/server";

import {
  readV15AcceptanceBatchEvidence,
  runV15AcceptanceBatch,
} from "@/features/experiments/v15-acceptance-batch";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readV15AcceptanceBatchEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = runV15AcceptanceBatch();
    return NextResponse.json(
      { ok: receipt.localStatus === "pass", receipt, evidence: readV15AcceptanceBatchEvidence() },
      { status: receipt.localStatus === "pass" ? 200 : 422 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "v1.5 acceptance failed." },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
