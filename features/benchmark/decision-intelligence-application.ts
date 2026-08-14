import { NextResponse } from "next/server";

import { readBenchmarkDecisionIntelligence } from "@/features/benchmark/decision-intelligence-service";

function boundedRunId(value: string | null) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 160 || !/^[a-zA-Z0-9._:-]+$/.test(trimmed)) {
    throw new Error("Invalid benchmark run id.");
  }
  return trimmed;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return NextResponse.json(
      readBenchmarkDecisionIntelligence({
        baselineRunId: boundedRunId(url.searchParams.get("baselineRunId")),
        candidateRunId: boundedRunId(url.searchParams.get("candidateRunId")),
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Benchmark decision intelligence could not be built.",
      },
      { status: 400 },
    );
  }
}
