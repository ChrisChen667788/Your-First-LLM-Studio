import { NextResponse } from "next/server";

import { readOperationalDecisionGovernanceTrain } from "@/features/experiments/operational-decision-governance-train";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(readOperationalDecisionGovernanceTrain());
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        sourceStatus: "pass",
        externalStatus: "hold",
        productionStatus: "blocked",
        error: error instanceof Error ? error.message : "Operational decision governance evidence could not be read.",
      },
      { status: 500 },
    );
  }
}
