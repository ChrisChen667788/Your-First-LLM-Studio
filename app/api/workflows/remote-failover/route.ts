import { NextResponse } from "next/server";

import { readRemoteWorkerFailoverEvidence } from "@/features/workflows/remote-worker-failover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readRemoteWorkerFailoverEvidence());
}
