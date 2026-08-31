import { NextResponse } from "next/server";

import { readOperationalAcceptanceTrain } from "@/features/experiments/operational-acceptance-train";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(readOperationalAcceptanceTrain());
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        sourceStatus: "pass",
        externalStatus: "hold",
        productionStatus: "blocked",
        error: error instanceof Error ? error.message : "Operational acceptance evidence could not be read.",
      },
      { status: 500 },
    );
  }
}
