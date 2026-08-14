import { NextResponse } from "next/server";

import {
  readFineTuneExecutionTruthEvidence,
  runFineTuneExecutionTruthAcceptance,
} from "@/features/finetune/execution-truth-acceptance";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readFineTuneExecutionTruthEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = await runFineTuneExecutionTruthAcceptance();
    return NextResponse.json(
      {
        ok: receipt.localStatus === "pass",
        receipt,
        evidence: readFineTuneExecutionTruthEvidence(),
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
            : "v1.6.8 Fine-tune execution truth acceptance failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
