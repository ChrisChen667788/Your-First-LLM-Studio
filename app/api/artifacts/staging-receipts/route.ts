import { NextResponse } from "next/server";

import {
  importArtifactStagingRoundTrip,
  readArtifactStagingRoundTripEvidence,
  type ArtifactStagingRoundTripInput,
} from "@/features/artifacts/staging-round-trip";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readArtifactStagingRoundTripEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = importArtifactStagingRoundTrip(
      await request.json() as ArtifactStagingRoundTripInput,
    );
    return NextResponse.json(
      { ok: receipt.status === "pass", receipt, evidence: readArtifactStagingRoundTripEvidence() },
      { status: receipt.status === "pass" ? 200 : 422 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Staging receipt import failed." },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
