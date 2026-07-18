import { NextResponse } from "next/server";
import {
  buildTrainingExecutionPlan,
  readTrainingExecutionPlanCatalog,
  type TrainingExecutionPlanInput,
} from "@/features/finetune/training-execution-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readTrainingExecutionPlanCatalog());
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { input?: TrainingExecutionPlanInput; execute?: boolean };
    if (!body.input) throw new Error("input is required.");
    const plan = buildTrainingExecutionPlan(body.input);
    if (body.execute) {
      return NextResponse.json({
        ok: false,
        error: "This boundary materializes execution plans only. Submit implemented backends through the Fine-tune worker API.",
        plan,
      }, { status: 409 });
    }
    return NextResponse.json({ ok: plan.planSupported, plan }, { status: plan.planSupported ? 200 : 422 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Training execution plan failed.",
    }, { status: 400 });
  }
}
