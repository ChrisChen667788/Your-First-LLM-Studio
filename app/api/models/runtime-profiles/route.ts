import { NextResponse } from "next/server";
import {
  deleteRuntimeProfile,
  getRuntimeProfileStoragePaths,
  readRuntimeProfileRegistry,
  upsertRuntimeProfile,
} from "@/features/models/runtime-profile-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    registry: readRuntimeProfileRegistry(),
    paths: getRuntimeProfileStoragePaths(),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const profile = upsertRuntimeProfile(body);
    return NextResponse.json({
      ok: true,
      profile,
      registry: readRuntimeProfileRegistry(),
      paths: getRuntimeProfileStoragePaths(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to save runtime profile.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "id is required." }, { status: 400 });
  }
  const deleted = deleteRuntimeProfile(id);
  return NextResponse.json({
    ok: deleted,
    deleted,
    registry: readRuntimeProfileRegistry(),
    paths: getRuntimeProfileStoragePaths(),
  });
}
