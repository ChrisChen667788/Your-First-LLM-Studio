import { NextResponse } from "next/server";

import { readGovernedAutonomyReadinessTrain } from "@/features/experiments/governed-autonomy-readiness-train";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(readGovernedAutonomyReadinessTrain());
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        sourceStatus: "pass",
        externalStatus: "hold",
        productionStatus: "blocked",
        error:
          error instanceof Error
            ? error.message
            : "Governed autonomy readiness could not be read.",
      },
      { status: 500 },
    );
  }
}
