import { NextResponse } from "next/server";

import {
  readAgentActionTrustRecoveryEvidence,
  runAgentActionTrustRecoveryAcceptance,
} from "@/features/agent/action-trust-recovery-evidence";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readAgentActionTrustRecoveryEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const result = await runAgentActionTrustRecoveryAcceptance();
    return NextResponse.json(
      {
        ok: result.receipt.localStatus === "pass",
        ...result,
        evidence: readAgentActionTrustRecoveryEvidence(),
      },
      { status: result.receipt.localStatus === "pass" ? 200 : 422 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Agent action trust acceptance failed." },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
