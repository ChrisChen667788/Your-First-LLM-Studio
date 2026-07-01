import { NextResponse } from "next/server";
import {
  readBenchmarkProgressRecord,
  requestBenchmarkProgressAction,
} from "@/features/benchmark/application";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runId = (searchParams.get("runId") || "").trim();
  const latest = searchParams.get("latest") === "1";
  const unfinishedOnly = searchParams.get("unfinishedOnly") === "1";

  try {
    return NextResponse.json(
      readBenchmarkProgressRecord({ runId, latest, unfinishedOnly }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read progress record.";
    if (latest && message === "Progress record not found.") {
      return NextResponse.json({
        ok: true,
        status: "idle",
        runId: null,
        latest: true,
        unfinishedOnly,
        message: "No benchmark progress record found.",
        updatedAt: new Date().toISOString(),
      });
    }
    return NextResponse.json(
      { error: message },
      { status: message === "Progress record not found." ? 404 : 400 },
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    runId?: string;
    action?: "stop" | "abandon";
  };
  const runId = typeof body.runId === "string" ? body.runId.trim() : "";
  const action = body.action;
  try {
    return NextResponse.json(
      requestBenchmarkProgressAction({ runId, action }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update progress record.";
    return NextResponse.json(
      { error: message },
      {
        status:
          message === "Progress record not found."
            ? 404
            : message === "Failed to update progress record."
              ? 500
              : 400,
      },
    );
  }
}
