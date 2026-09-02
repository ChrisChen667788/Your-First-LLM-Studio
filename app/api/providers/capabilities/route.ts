import { NextResponse } from "next/server";

import {
  probeProviderCapabilityTarget,
  readProviderCapabilityCatalog,
} from "@/features/providers/capability-application";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(readProviderCapabilityCatalog());
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { targetId?: unknown; thinkingMode?: unknown };
    if (typeof body.targetId !== "string" || !body.targetId.trim()) {
      return NextResponse.json({ ok: false, error: "targetId is required." }, { status: 400 });
    }
    const thinkingMode = body.thinkingMode === "thinking" ? "thinking" : "standard";
    return NextResponse.json(await probeProviderCapabilityTarget({ targetId: body.targetId, thinkingMode }));
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
