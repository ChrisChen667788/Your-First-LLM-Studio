import { NextResponse } from "next/server";
import { readExternalProductionReadiness } from "@/features/experiments/external-production-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readExternalProductionReadiness());
}
