import { NextResponse } from "next/server";

import { readAiOperationsIntelligenceTrain } from "@/features/experiments/ai-operations-intelligence-train";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(readAiOperationsIntelligenceTrain());
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
            : "AI operations intelligence could not be read.",
      },
      { status: 500 },
    );
  }
}
