import { NextResponse } from "next/server";

import { readRemediationExecutionTrain } from "@/features/experiments/remediation-execution-train";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(readRemediationExecutionTrain());
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        sourceStatus: "pass",
        externalStatus: "hold",
        productionStatus: "blocked",
        error: error instanceof Error ? error.message : "Remediation execution evidence could not be read.",
      },
      { status: 500 },
    );
  }
}
