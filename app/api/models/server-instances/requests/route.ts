import { NextResponse } from "next/server";
import { readServerRequestLedger } from "@/features/models/server-request-ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const serverId = new URL(request.url).searchParams.get("serverId") || undefined;
  return NextResponse.json(readServerRequestLedger(serverId));
}
