import { NextResponse } from "next/server";
import { readServerLifecycleEvidence, runServerLifecycleAction } from "@/features/models/server-lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readServerLifecycleEvidence()); }
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Parameters<typeof runServerLifecycleAction>[0];
  const receipt = await runServerLifecycleAction(body);
  return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readServerLifecycleEvidence() }, { status: receipt.status === "pass" ? 200 : 422 });
}
