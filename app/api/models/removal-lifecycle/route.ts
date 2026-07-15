import { NextResponse } from "next/server";
import { readModelRemovalLifecycleEvidence, rehearseModelRemovalLifecycle } from "@/features/models/removal-lifecycle";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readModelRemovalLifecycleEvidence()); }
export async function POST() { const receipt = rehearseModelRemovalLifecycle(); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readModelRemovalLifecycleEvidence() }, { status: receipt.status === "pass" ? 200 : 422 }); }
