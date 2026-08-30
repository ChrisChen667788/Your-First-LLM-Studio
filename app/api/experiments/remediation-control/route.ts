import { NextResponse } from "next/server";

import { readRemediationControlTrain } from "@/features/experiments/remediation-control-train";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(readRemediationControlTrain());
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
            : "Remediation control evidence could not be read.",
      },
      { status: 500 },
    );
  }
}
