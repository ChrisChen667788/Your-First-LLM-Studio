import { NextResponse } from "next/server";
import { readDesktopUpdateChannelEvidence, rehearseDesktopUpdateChannel } from "@/features/desktop/update-channel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() { return NextResponse.json(readDesktopUpdateChannelEvidence()); }
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { channel?: "stable" | "preview"; fromVersion?: string; toVersion?: string };
    const receipt = rehearseDesktopUpdateChannel(body);
    return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readDesktopUpdateChannelEvidence() });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Desktop update rehearsal failed." }, { status: 400 }); }
}
