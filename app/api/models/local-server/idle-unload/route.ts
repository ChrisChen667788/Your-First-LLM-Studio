import { NextResponse } from "next/server";
import {
  getRuntimeProfileStoragePaths,
  readIdleUnloadConfig,
  updateIdleUnloadConfig,
} from "@/features/models/runtime-profile-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    config: readIdleUnloadConfig(),
    paths: getRuntimeProfileStoragePaths(),
  });
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const config = updateIdleUnloadConfig(body);
    return NextResponse.json({
      ok: true,
      config,
      paths: getRuntimeProfileStoragePaths(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to update idle-unload config.",
      },
      { status: 400 },
    );
  }
}
