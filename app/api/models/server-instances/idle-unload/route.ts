import { NextResponse } from "next/server";
import { readIdleUnloadDaemonEvidence, runIdleUnloadDaemonTick } from "@/features/models/idle-unload-daemon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readIdleUnloadDaemonEvidence()); }
export async function POST(request: Request) { const body = await request.json().catch(() => ({})) as { execute?: boolean; now?: string }; const receipt = await runIdleUnloadDaemonTick(body); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readIdleUnloadDaemonEvidence() }, { status: receipt.status === "pass" ? 200 : 422 }); }
