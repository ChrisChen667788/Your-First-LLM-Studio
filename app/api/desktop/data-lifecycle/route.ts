import { NextResponse } from "next/server";
import { readDesktopDataLifecycleEvidence, rehearseDesktopDataLifecycle } from "@/features/desktop/data-lifecycle";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readDesktopDataLifecycleEvidence()); }
export async function POST() { const receipt = rehearseDesktopDataLifecycle(); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readDesktopDataLifecycleEvidence() }, { status: receipt.status === "pass" ? 200 : 500 }); }
