import { NextResponse } from "next/server";
import {
  readOllamaConformanceEvidence,
  runOllamaModelConformance,
} from "@/features/runtime/ollama-conformance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readOllamaConformanceEvidence());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { model?: string };
  const report = await runOllamaModelConformance(body.model);
  return NextResponse.json({ ok: report.ok, report, evidence: readOllamaConformanceEvidence() }, { status: report.ok ? 200 : 422 });
}
