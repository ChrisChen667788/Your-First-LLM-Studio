import { NextResponse } from "next/server";

import { readProductionBridgeReadiness } from "@/features/experiments/production-bridge-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readProductionBridgeReadiness());
}
