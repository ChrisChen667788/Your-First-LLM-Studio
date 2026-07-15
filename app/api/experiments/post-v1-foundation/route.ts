import { NextResponse } from "next/server";
import { readPostV1Foundation } from "@/features/experiments/post-v1-foundation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readPostV1Foundation());
}
