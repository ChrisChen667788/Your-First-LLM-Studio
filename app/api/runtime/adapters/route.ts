import { NextResponse } from "next/server";
import { readRuntimeAdapterConformance } from "@/features/runtime/adapter-conformance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readRuntimeAdapterConformance());
}
