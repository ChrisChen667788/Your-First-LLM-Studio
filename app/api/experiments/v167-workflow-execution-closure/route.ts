import { NextResponse } from "next/server";

import {
  readWorkflowExecutionClosureEvidence,
  runWorkflowExecutionClosureAcceptance,
} from "@/features/workflows/execution-closure-acceptance";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readWorkflowExecutionClosureEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = await runWorkflowExecutionClosureAcceptance();
    return NextResponse.json(
      {
        ok: receipt.localStatus === "pass",
        receipt,
        evidence: readWorkflowExecutionClosureEvidence(),
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
            : "v1.6.7 workflow execution acceptance failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
