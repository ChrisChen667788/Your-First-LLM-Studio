import { NextResponse } from "next/server";

import {
  readReproducibleTrainingRecipeEvidence,
  runReproducibleTrainingRecipeRehearsal,
} from "@/features/finetune/reproducible-training-recipe-evidence";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readReproducibleTrainingRecipeEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const result = runReproducibleTrainingRecipeRehearsal();
    return NextResponse.json(
      {
        ok: result.receipt.localStatus === "pass",
        ...result,
        evidence: readReproducibleTrainingRecipeEvidence(),
      },
      { status: result.receipt.localStatus === "pass" ? 200 : 422 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Reproducible training recipe rehearsal failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
