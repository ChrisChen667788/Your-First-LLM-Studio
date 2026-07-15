import { NextResponse } from "next/server";
import { readServerNetworkPolicyEvidence, rehearseServerNetworkPolicy } from "@/features/models/server-network-policy";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readServerNetworkPolicyEvidence()); }
export async function POST() { const receipt = rehearseServerNetworkPolicy(); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readServerNetworkPolicyEvidence() }, { status: receipt.status === "pass" ? 200 : 422 }); }
