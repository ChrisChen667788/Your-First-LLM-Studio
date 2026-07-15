import { NextResponse } from "next/server";
import { analyzePairedEvaluation, readEvaluationStatisticsEvidence } from "@/features/evaluation/statistics-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() { return NextResponse.json(readEvaluationStatisticsEvidence()); }
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { baseline?: number[]; candidate?: number[]; minimumDelta?: number; minimumSamples?: number };
  const report = analyzePairedEvaluation(body);
  return NextResponse.json({ ok: report.status === "pass", report, evidence: readEvaluationStatisticsEvidence() }, { status: report.status === "invalid" ? 400 : report.status === "hold" ? 422 : 200 });
}
