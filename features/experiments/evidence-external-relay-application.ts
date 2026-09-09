import { NextResponse } from "next/server";

import {
  readExternalEvidenceRelayTrainEvidence,
  runExternalEvidenceRelayTrainAcceptance,
} from "@/features/experiments/evidence-external-relay-train";
import { assertTrustedOperatorRequest, operatorAuthorizationStatus } from "@/features/security/operator-auth";

export function handleExternalEvidenceRelayTrainGet() {
  return NextResponse.json(readExternalEvidenceRelayTrainEvidence());
}

export async function handleExternalEvidenceRelayTrainPost(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = runExternalEvidenceRelayTrainAcceptance();
    return NextResponse.json({
      ok: receipt.sourceStatus === "pass",
      receipt,
      evidence: readExternalEvidenceRelayTrainEvidence(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "External evidence relay request failed." },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
