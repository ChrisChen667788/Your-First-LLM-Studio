import { NextResponse } from "next/server";

import { readModelSupplyChainOperationsEvidence, runModelSupplyChainOperationsRehearsal } from "@/features/models/supply-chain-operations-evidence";
import { assertTrustedOperatorRequest, operatorAuthorizationStatus } from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readModelSupplyChainOperationsEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const result = runModelSupplyChainOperationsRehearsal();
    return NextResponse.json({ ok: result.receipt.localStatus === "pass", ...result, evidence: readModelSupplyChainOperationsEvidence() }, { status: result.receipt.localStatus === "pass" ? 200 : 422 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Model supply-chain rehearsal failed." }, { status: operatorAuthorizationStatus(error) });
  }
}
