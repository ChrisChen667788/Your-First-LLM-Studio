import { NextResponse } from "next/server";

import {
  readEnterpriseControlPlaneCandidateEvidence,
  runEnterpriseControlPlaneCandidateRehearsal,
} from "@/features/deployment/enterprise-control-plane-candidate";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readEnterpriseControlPlaneCandidateEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const result = runEnterpriseControlPlaneCandidateRehearsal();
    return NextResponse.json(
      {
        ok: result.receipt.localStatus === "pass",
        ...result,
        evidence: readEnterpriseControlPlaneCandidateEvidence(),
      },
      { status: result.receipt.localStatus === "pass" ? 200 : 422 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Enterprise control-plane rehearsal failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
