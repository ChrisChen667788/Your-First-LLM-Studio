import { NextResponse } from "next/server";

import {
  readEvidenceOperationsTrainEvidence,
  recordEvidenceOperationsCandidate,
  runEvidenceOperationsTrainAcceptance,
} from "@/features/experiments/evidence-operations-train";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export function handleEvidenceOperationsTrainGet() {
  return NextResponse.json(readEvidenceOperationsTrainEvidence());
}

export async function handleEvidenceOperationsTrainPost(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const body = await request.json().catch(() => ({})) as { candidateReceipt?: unknown };
    if (body.candidateReceipt) {
      const recorded = recordEvidenceOperationsCandidate(body.candidateReceipt);
      return NextResponse.json({
        ok: true,
        recorded,
        evidence: readEvidenceOperationsTrainEvidence(),
      });
    }
    const receipt = runEvidenceOperationsTrainAcceptance();
    return NextResponse.json(
      {
        ok: receipt.localStatus === "pass",
        receipt,
        evidence: readEvidenceOperationsTrainEvidence(),
      },
      { status: receipt.localStatus === "pass" ? 200 : 422 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : "Evidence operations request failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
