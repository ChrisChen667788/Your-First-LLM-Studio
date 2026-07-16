import { NextResponse } from "next/server";

import { readDesktopExternalAcceptance } from "@/features/desktop/external-acceptance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readDesktopExternalAcceptance());
}
