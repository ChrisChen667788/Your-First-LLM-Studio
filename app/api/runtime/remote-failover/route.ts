import { NextResponse } from "next/server";
import { readRemoteFailoverEvidence, rehearseRemoteFailover } from "@/features/runtime/remote-failover";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readRemoteFailoverEvidence()); }
export async function POST() { const receipt = rehearseRemoteFailover(); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readRemoteFailoverEvidence() }, { status: receipt.status === "pass" ? 200 : 422 }); }
