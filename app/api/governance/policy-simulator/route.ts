import { NextResponse } from "next/server";
import { readGovernancePolicySimulationEvidence, runGovernancePolicySimulation } from "@/features/governance/policy-simulator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readGovernancePolicySimulationEvidence()); }
export async function POST() { const receipt = runGovernancePolicySimulation(); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readGovernancePolicySimulationEvidence() }, { status: receipt.status === "pass" ? 200 : 422 }); }
