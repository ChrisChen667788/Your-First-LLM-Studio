import { NextResponse } from "next/server";

import { readContinuousAssuranceTrain } from "@/features/experiments/continuous-assurance-train";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readContinuousAssuranceTrain());
}
