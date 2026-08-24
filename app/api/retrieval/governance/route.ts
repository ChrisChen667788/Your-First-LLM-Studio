import { NextResponse } from "next/server";

import { readRagGovernanceEvidence, runRagGovernanceRehearsal } from "@/features/retrieval/rag-governance-evidence";
import { assertTrustedOperatorRequest, operatorAuthorizationStatus } from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readRagGovernanceEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const result = runRagGovernanceRehearsal();
    return NextResponse.json({ ok: result.receipt.localStatus === "pass", ...result, evidence: readRagGovernanceEvidence() }, { status: result.receipt.localStatus === "pass" ? 200 : 422 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "RAG governance rehearsal failed." }, { status: operatorAuthorizationStatus(error) });
  }
}
