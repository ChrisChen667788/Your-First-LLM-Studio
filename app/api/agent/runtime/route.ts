import { NextResponse } from "next/server";
import { handleAgentRuntimeStatusRequest } from "@/features/agent/runtime-status-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const result = await handleAgentRuntimeStatusRequest(request);
  return NextResponse.json(result.payload, { status: result.status });
}
