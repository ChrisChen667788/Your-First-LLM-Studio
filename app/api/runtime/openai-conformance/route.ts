import { NextResponse } from "next/server";
import { readOpenAiCompatibleConformance, runOpenAiCompatibleConformance } from "@/features/runtime/openai-compatible-conformance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() { return NextResponse.json(readOpenAiCompatibleConformance()); }
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { serverId?: string; baseUrl?: string; model?: string; apiKey?: string };
  const report = await runOpenAiCompatibleConformance(body);
  return NextResponse.json({ ok: report.ok, report, evidence: readOpenAiCompatibleConformance() }, { status: report.ok ? 200 : 422 });
}
