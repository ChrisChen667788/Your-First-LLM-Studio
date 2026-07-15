import { NextResponse } from "next/server";
import { readEvaluationRegressionSuiteEvidence, runEvaluationRegressionSuite, type RegressionMetricInput } from "@/features/evaluation/regression-suite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readEvaluationRegressionSuiteEvidence()); }
export async function POST(request: Request) { try { const body = await request.json().catch(() => ({})) as { metrics?: RegressionMetricInput[] }; const receipt = runEvaluationRegressionSuite({ metrics: Array.isArray(body.metrics) ? body.metrics : [] }); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readEvaluationRegressionSuiteEvidence() }, { status: receipt.status === "pass" ? 200 : 422 }); } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Evaluation regression suite failed." }, { status: 400 }); } }
