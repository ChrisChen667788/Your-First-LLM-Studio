import { NextResponse } from "next/server";

import {
  readWorkflowDebuggerClosureEvidence,
  runWorkflowDebuggerClosureRehearsal,
} from "@/features/workflows/debugger-closure-evidence";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const executionId = new URL(request.url).searchParams.get("executionId") || undefined;
  return NextResponse.json(readWorkflowDebuggerClosureEvidence(executionId));
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const result = runWorkflowDebuggerClosureRehearsal();
    return NextResponse.json(
      {
        ok: result.receipt.localStatus === "pass",
        ...result,
        evidence: readWorkflowDebuggerClosureEvidence(result.source.id),
      },
      { status: result.receipt.localStatus === "pass" ? 200 : 422 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Workflow debugger rehearsal failed." },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
