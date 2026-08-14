import { NextResponse } from "next/server";

import {
  readV161ApplicationContractsEvidence,
  runV161ApplicationContractsAcceptance,
} from "@/features/experiments/v161-application-contracts";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readV161ApplicationContractsEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = runV161ApplicationContractsAcceptance();
    return NextResponse.json(
      {
        ok: receipt.localStatus === "pass",
        receipt,
        evidence: readV161ApplicationContractsEvidence(),
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
            : "v1.6.1 application contract acceptance failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
