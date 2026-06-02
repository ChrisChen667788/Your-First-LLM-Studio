import { NextResponse } from "next/server";
import {
  deleteBenchmarkReleaseEvidence,
  readBenchmarkReleaseEvidenceEntries,
  saveBenchmarkReleaseEvidence,
} from "@/features/benchmark/application";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    entries: readBenchmarkReleaseEvidenceEntries(),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      runId?: string;
      title?: string;
      note?: string;
    };
    const entry = saveBenchmarkReleaseEvidence(body);
    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update release evidence." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const runId = (searchParams.get("runId") || "").trim();
  try {
    const removed = deleteBenchmarkReleaseEvidence(runId);
    return NextResponse.json({ ok: removed });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove release evidence." },
      { status: 400 },
    );
  }
}
