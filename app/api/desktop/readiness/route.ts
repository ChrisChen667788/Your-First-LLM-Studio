import { NextResponse } from "next/server";
import { readDesktopFirstRunReadiness } from "@/features/desktop/first-run-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readDesktopFirstRunReadiness());
}
