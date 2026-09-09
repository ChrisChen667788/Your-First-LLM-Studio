import { NextResponse } from "next/server";

import {
  readExternalEvidenceHandoffTrainEvidence,
  runExternalEvidenceHandoffTrainAcceptance,
} from "@/features/experiments/evidence-external-handoff-train";
import { assertTrustedOperatorRequest, operatorAuthorizationStatus } from "@/features/security/operator-auth";

export function handleExternalEvidenceHandoffTrainGet() {
  return NextResponse.json(readExternalEvidenceHandoffTrainEvidence());
}

export async function handleExternalEvidenceHandoffTrainPost(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = runExternalEvidenceHandoffTrainAcceptance();
    return NextResponse.json({
      ok: receipt.sourceStatus === "pass",
      receipt,
      evidence: readExternalEvidenceHandoffTrainEvidence(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "External evidence handoff request failed." },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
