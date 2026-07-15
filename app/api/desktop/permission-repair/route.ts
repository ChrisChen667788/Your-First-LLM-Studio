import { NextResponse } from "next/server";
import { readDesktopPermissionRepairEvidence, rehearseDesktopPermissionRepair } from "@/features/desktop/permission-repair";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readDesktopPermissionRepairEvidence()); }
export async function POST() { const receipt = rehearseDesktopPermissionRepair(); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readDesktopPermissionRepairEvidence() }, { status: receipt.status === "pass" ? 200 : 422 }); }
