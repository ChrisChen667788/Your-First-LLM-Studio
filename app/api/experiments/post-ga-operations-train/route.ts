import { NextResponse } from "next/server";

import { readPostGaOperationsTrain } from "@/features/experiments/post-ga-operations-train";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readPostGaOperationsTrain());
}
