import { NextResponse } from "next/server";

import { readArtifactFederationTrustEvidence, runArtifactFederationTrustRehearsal } from "@/features/artifacts/federation-trust-evidence";
import { assertTrustedOperatorRequest, operatorAuthorizationStatus } from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readArtifactFederationTrustEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const result = runArtifactFederationTrustRehearsal();
    return NextResponse.json({ ok: result.receipt.localStatus === "pass", ...result, evidence: readArtifactFederationTrustEvidence() }, { status: result.receipt.localStatus === "pass" ? 200 : 422 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Artifact federation rehearsal failed." }, { status: operatorAuthorizationStatus(error) });
  }
}
