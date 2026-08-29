import { NextResponse } from "next/server";

import { readOpenEcosystemInteroperabilityTrain } from "@/features/experiments/open-ecosystem-interoperability-train";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(readOpenEcosystemInteroperabilityTrain());
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
            : "Open ecosystem interoperability could not be read.",
      },
      { status: 500 },
    );
  }
}
