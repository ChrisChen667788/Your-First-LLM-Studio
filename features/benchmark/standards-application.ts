import { NextResponse } from "next/server";
import type { BenchmarkStandardsRefreshRequest } from "@/features/benchmark/standards-contracts";
import {
  readBenchmarkStandards,
  refreshBenchmarkStandards,
} from "@/features/benchmark/standards-service";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const autoRefresh = url.searchParams.get("refresh") !== "manual";
    return NextResponse.json(await readBenchmarkStandards({ autoRefresh }));
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to read benchmark standards.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<BenchmarkStandardsRefreshRequest>;
    if (body.action !== "refresh") {
      return NextResponse.json(
        { ok: false, error: "Unsupported benchmark standards action." },
        { status: 400 },
      );
    }
    const standardIds = Array.isArray(body.standardIds)
      ? body.standardIds.filter((id): id is string => typeof id === "string")
      : undefined;
    return NextResponse.json(await refreshBenchmarkStandards(standardIds));
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to refresh benchmark standards.",
      },
      { status: 500 },
    );
  }
}
