import { NextResponse } from "next/server";

import {
  readEvidenceAuthorityCampaignTrainEvidence,
  runEvidenceAuthorityCampaignTrainAcceptance,
} from "@/features/experiments/evidence-authority-campaign-train";
import { assertTrustedOperatorRequest, operatorAuthorizationStatus } from "@/features/security/operator-auth";

export function handleEvidenceAuthorityCampaignTrainGet() {
  return NextResponse.json(readEvidenceAuthorityCampaignTrainEvidence());
}

export async function handleEvidenceAuthorityCampaignTrainPost(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = runEvidenceAuthorityCampaignTrainAcceptance();
    return NextResponse.json({
      ok: receipt.sourceStatus === "pass",
      receipt,
      evidence: readEvidenceAuthorityCampaignTrainEvidence(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Evidence authority campaign request failed." },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
