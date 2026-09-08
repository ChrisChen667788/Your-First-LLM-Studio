import { NextResponse } from "next/server";

import {
  readEvidenceAcceptanceTrainEvidence,
  runEvidenceAcceptanceTrainAcceptance,
} from "@/features/experiments/evidence-acceptance-train";
import { assertTrustedOperatorRequest, operatorAuthorizationStatus } from "@/features/security/operator-auth";

export function handleEvidenceAcceptanceTrainGet() {
  return NextResponse.json(readEvidenceAcceptanceTrainEvidence());
}

export async function handleEvidenceAcceptanceTrainPost(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = runEvidenceAcceptanceTrainAcceptance();
    return NextResponse.json({
      ok: receipt.sourceStatus === "pass",
      receipt,
      evidence: readEvidenceAcceptanceTrainEvidence(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Evidence acceptance request failed." },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
