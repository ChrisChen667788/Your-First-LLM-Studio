import { NextResponse } from "next/server";

import { readProductionLifecycleClosure } from "@/features/experiments/production-lifecycle-closure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readProductionLifecycleClosure());
}
