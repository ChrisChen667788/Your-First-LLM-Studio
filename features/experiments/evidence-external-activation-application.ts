import { NextResponse } from "next/server";

import {
  readExternalEvidenceActivationTrainEvidence,
  runExternalEvidenceActivationTrainAcceptance,
} from "@/features/experiments/evidence-external-activation-train";
import { assertTrustedOperatorRequest, operatorAuthorizationStatus } from "@/features/security/operator-auth";

export function handleExternalEvidenceActivationTrainGet() {
  return NextResponse.json(readExternalEvidenceActivationTrainEvidence());
}

export async function handleExternalEvidenceActivationTrainPost(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = runExternalEvidenceActivationTrainAcceptance();
    return NextResponse.json({
      ok: receipt.sourceStatus === "pass",
      receipt,
      evidence: readExternalEvidenceActivationTrainEvidence(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "External evidence activation request failed." },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
