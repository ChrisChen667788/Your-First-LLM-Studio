import { NextResponse } from "next/server";
import { readTelemetryEvidence } from "@/features/telemetry/trace-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readTelemetryEvidence());
}
