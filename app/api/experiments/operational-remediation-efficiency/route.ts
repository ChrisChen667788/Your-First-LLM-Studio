import { NextResponse } from "next/server";

import { readOperationalRemediationEfficiencyTrain } from "@/features/experiments/operational-remediation-efficiency-train";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(readOperationalRemediationEfficiencyTrain());
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        sourceStatus: "pass",
        externalStatus: "hold",
        productionStatus: "blocked",
        error: error instanceof Error ? error.message : "Operational remediation evidence could not be read.",
      },
      { status: 500 },
    );
  }
}
