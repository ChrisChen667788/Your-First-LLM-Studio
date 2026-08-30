import { NextResponse } from "next/server";

import { readServiceReadinessTrain } from "@/features/experiments/service-readiness-train";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(readServiceReadinessTrain());
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
            : "Service readiness evidence could not be read.",
      },
      { status: 500 },
    );
  }
}
