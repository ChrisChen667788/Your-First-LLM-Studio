import { NextResponse } from "next/server";

import { readReleaseAuthorityDecisionLedger } from "@/features/experiments/release-authority-decision-ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readReleaseAuthorityDecisionLedger());
}
