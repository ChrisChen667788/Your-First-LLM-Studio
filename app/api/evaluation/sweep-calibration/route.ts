import { NextResponse } from "next/server";
import { readSweepCalibrationEvidence, runSweepCalibrationRehearsal } from "@/features/evaluation/sweep-calibration";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readSweepCalibrationEvidence()); }
export async function POST() { const receipt = runSweepCalibrationRehearsal(); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readSweepCalibrationEvidence() }, { status: receipt.status === "pass" ? 200 : 422 }); }
