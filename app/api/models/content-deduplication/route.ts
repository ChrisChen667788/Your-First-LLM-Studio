import { NextResponse } from "next/server";
import { readModelContentDedupEvidence, runModelContentDedupRehearsal } from "@/features/models/content-deduplication";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() { return NextResponse.json(readModelContentDedupEvidence()); }
export async function POST() { const receipt = runModelContentDedupRehearsal(); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readModelContentDedupEvidence() }, { status: receipt.status === "pass" ? 200 : 500 }); }
