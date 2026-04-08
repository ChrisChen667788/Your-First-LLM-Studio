import { NextResponse } from "next/server";
import { readCompareProgress } from "@/lib/agent/compare-progress-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("requestId");

  if (!requestId) {
    return NextResponse.json({ error: "requestId is required." }, { status: 400 });
  }

  const progress = readCompareProgress(requestId);
  if (!progress) {
    return NextResponse.json({ error: `No compare progress found for ${requestId}.` }, { status: 404 });
  }

  return NextResponse.json(progress);
}
