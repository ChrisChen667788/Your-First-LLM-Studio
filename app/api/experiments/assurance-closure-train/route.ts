import { NextResponse } from "next/server";

import { readAssuranceClosureTrain } from "@/features/experiments/assurance-closure-train";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readAssuranceClosureTrain());
}
