import { NextResponse } from "next/server";
import { buildExternalStorageMigrationPlan, readExternalStorageMigrationEvidence, rehearseExternalStorageMigration } from "@/features/models/external-storage-migration";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: Request) { const url = new URL(request.url); return NextResponse.json({ ...readExternalStorageMigrationEvidence(), requestedPlan: buildExternalStorageMigrationPlan({ sourcePath: url.searchParams.get("sourcePath") || undefined, destinationRoot: url.searchParams.get("destinationRoot") || undefined }) }); }
export async function POST() { const receipt = rehearseExternalStorageMigration(); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readExternalStorageMigrationEvidence() }, { status: receipt.status === "pass" ? 200 : 500 }); }
