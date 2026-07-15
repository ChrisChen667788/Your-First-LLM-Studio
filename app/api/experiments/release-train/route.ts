import { NextResponse } from "next/server";
import { readReleaseTrain } from "@/features/experiments/release-train";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readReleaseTrain());
}
