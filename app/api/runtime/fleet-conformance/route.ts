import { NextResponse } from "next/server";
import { readRuntimeFleetConformanceEvidence, runFleetServerConformance, snapshotRuntimeFleetConformance } from "@/features/runtime/fleet-conformance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readRuntimeFleetConformanceEvidence()); }
export async function POST(request: Request) {
  try { const body = await request.json().catch(() => ({})) as { action?: string; serverId?: string; modelId?: string }; const result = body.action === "run-server" ? await runFleetServerConformance(body) : { snapshot: snapshotRuntimeFleetConformance() }; const status = result.snapshot.status === "pass" ? 200 : 422; return NextResponse.json({ ok: status === 200, ...result, evidence: readRuntimeFleetConformanceEvidence() }, { status }); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Fleet conformance failed." }, { status: 400 }); }
}
