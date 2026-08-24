import { NextResponse } from "next/server";

import {
  readEnterpriseProductionGaEvidence,
  recordEnterpriseProductionGaReconciliation,
} from "@/features/experiments/enterprise-production-ga";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readEnterpriseProductionGaEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = recordEnterpriseProductionGaReconciliation();
    return NextResponse.json(
      {
        ok: receipt.localStatus === "pass",
        receipt,
        evidence: readEnterpriseProductionGaEvidence(),
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
            : "Enterprise production GA reconciliation failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
