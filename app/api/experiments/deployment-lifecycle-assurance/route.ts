import { NextResponse } from "next/server";

import { readDeploymentLifecycleAssuranceTrain } from "@/features/experiments/deployment-lifecycle-assurance-train";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(readDeploymentLifecycleAssuranceTrain());
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
            : "Deployment lifecycle assurance could not be read.",
      },
      { status: 500 },
    );
  }
}
