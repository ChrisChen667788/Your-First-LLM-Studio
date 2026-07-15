import { NextResponse } from "next/server";
import {
  readServerInstanceRegistry,
  upsertServerInstance,
} from "@/features/models/server-instance-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readServerInstanceRegistry());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Parameters<
      typeof upsertServerInstance
    >[0];
    const instance = upsertServerInstance(body);
    return NextResponse.json({ ok: true, instance, registry: readServerInstanceRegistry() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Server registry update failed." },
      { status: 400 },
    );
  }
}
