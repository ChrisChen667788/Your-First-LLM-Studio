import { NextResponse } from "next/server";

import {
  readV16FeatureOwnershipEvidence,
  runV16FeatureOwnershipAcceptance,
} from "@/features/experiments/v16-feature-ownership";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readV16FeatureOwnershipEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = runV16FeatureOwnershipAcceptance();
    return NextResponse.json(
      {
        ok: receipt.localStatus === "pass",
        receipt,
        evidence: readV16FeatureOwnershipEvidence(),
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
            : "v1.6 feature ownership acceptance failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
