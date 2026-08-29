import { NextResponse } from "next/server";

import { readSustainableOperationsUpgradeTrain } from "@/features/experiments/sustainable-operations-upgrade-train";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(readSustainableOperationsUpgradeTrain());
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        sourceStatus: "pass",
        externalStatus: "hold",
        productionStatus: "blocked",
        error: error instanceof Error ? error.message : "Sustainable operations evidence could not be read.",
      },
      { status: 500 },
    );
  }
}
