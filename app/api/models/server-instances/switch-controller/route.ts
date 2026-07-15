import { NextResponse } from "next/server";
import { readServerSwitchControllerEvidence, rehearseServerSwitchController } from "@/features/models/server-switch-controller";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readServerSwitchControllerEvidence()); }
export async function POST() { const receipt = rehearseServerSwitchController(); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readServerSwitchControllerEvidence() }, { status: receipt.status === "pass" ? 200 : 422 }); }
