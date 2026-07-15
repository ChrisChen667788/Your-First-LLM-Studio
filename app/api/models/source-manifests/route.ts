import { NextResponse } from "next/server";
import { materializeModelSourceManifest, readModelSourceManifestEvidence, rehearseModelSourceManifest } from "@/features/models/source-manifest";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readModelSourceManifestEvidence()); }
export async function POST(request: Request) { try { const body = await request.json().catch(() => ({})) as Record<string, unknown>; const receipt = body.source ? materializeModelSourceManifest(body as Parameters<typeof materializeModelSourceManifest>[0]) : rehearseModelSourceManifest(); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readModelSourceManifestEvidence() }, { status: receipt.status === "pass" ? 200 : 422 }); } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Source manifest failed." }, { status: 400 }); } }
