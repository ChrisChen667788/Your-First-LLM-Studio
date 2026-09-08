import { NextResponse } from "next/server";

import {
  readEvidenceAdjudicationTrainEvidence,
  runEvidenceAdjudicationTrainAcceptance,
} from "@/features/experiments/evidence-adjudication-train";
import { assertTrustedOperatorRequest, operatorAuthorizationStatus } from "@/features/security/operator-auth";

export function handleEvidenceAdjudicationTrainGet() {
  return NextResponse.json(readEvidenceAdjudicationTrainEvidence());
}

export async function handleEvidenceAdjudicationTrainPost(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = runEvidenceAdjudicationTrainAcceptance();
    return NextResponse.json({
      ok: receipt.sourceStatus === "pass",
      receipt,
      evidence: readEvidenceAdjudicationTrainEvidence(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Evidence adjudication request failed." },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
