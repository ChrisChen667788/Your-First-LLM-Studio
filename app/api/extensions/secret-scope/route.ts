import { NextResponse } from "next/server";
import { readExtensionSecretScopeEvidence, rehearseExtensionSecretScopePolicy } from "@/features/extensions/secret-scope-policy";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readExtensionSecretScopeEvidence()); }
export async function POST() { const receipt = rehearseExtensionSecretScopePolicy(); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readExtensionSecretScopeEvidence() }, { status: receipt.status === "pass" ? 200 : 422 }); }
