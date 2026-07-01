import { NextResponse } from "next/server";
import { readModelRuntimeOperations } from "@/features/models/runtime-profile-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get("targetId")?.trim() || undefined;
  const logLimit = Number(searchParams.get("limit") || 40);

  return NextResponse.json({
    ok: true,
    operations: readModelRuntimeOperations({
      targetId,
      logLimit,
    }),
  });
}
