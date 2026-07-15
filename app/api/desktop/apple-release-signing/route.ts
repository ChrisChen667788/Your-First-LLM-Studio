import { NextResponse } from "next/server";
import {
  readAppleReleaseSigningReadiness,
  runAppleReleaseSigningPipeline,
} from "@/features/desktop/apple-release-signing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readAppleReleaseSigningReadiness());
}

export async function POST() {
  try {
    return NextResponse.json(runAppleReleaseSigningPipeline());
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Apple release signing failed.",
      readiness: readAppleReleaseSigningReadiness(),
    }, { status: 409 });
  }
}
