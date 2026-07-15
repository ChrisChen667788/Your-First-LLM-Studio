import { NextResponse } from "next/server";
import { readArtifactInstallLifecycleEvidence, rehearseArtifactInstallLifecycle } from "@/features/artifacts/install-lifecycle";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readArtifactInstallLifecycleEvidence()); }
export async function POST() { const receipt = rehearseArtifactInstallLifecycle(); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readArtifactInstallLifecycleEvidence() }, { status: receipt.status === "pass" ? 200 : 422 }); }
