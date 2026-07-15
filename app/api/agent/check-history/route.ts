import { NextResponse } from "next/server";
import { readAgentCheckHistory } from "@/features/agent/check-history-application";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  return NextResponse.json(readAgentCheckHistory({
    targetId: searchParams.get("targetId") || undefined,
    limit: Number(searchParams.get("limit") || "50"),
  }));
}
