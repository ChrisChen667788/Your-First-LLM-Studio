import { NextResponse } from "next/server";

import {
  readV164OfficialEvaluatorEvidence,
  runV164OfficialEvaluatorAcceptance,
} from "@/features/experiments/v164-official-evaluators";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readV164OfficialEvaluatorEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = await runV164OfficialEvaluatorAcceptance();
    return NextResponse.json(
      {
        ok: receipt.localStatus === "pass",
        receipt,
        evidence: readV164OfficialEvaluatorEvidence(),
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
            : "v1.6.4 official evaluator acceptance failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
