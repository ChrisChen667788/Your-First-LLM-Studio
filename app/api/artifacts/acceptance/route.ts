import { NextResponse } from "next/server";
import { runArtifactEcosystemAcceptance } from "@/features/artifacts/artifact-ecosystem-acceptance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const receipt = runArtifactEcosystemAcceptance();
    return NextResponse.json(
      { ok: receipt.status === "pass", receipt },
      { status: receipt.status === "pass" ? 200 : 422 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Artifact ecosystem acceptance failed.",
      },
      { status: 422 },
    );
  }
}
