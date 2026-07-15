import { NextResponse } from "next/server";
import {
  evaluateTrainingCompatibility,
  readTrainingCapabilityRegistry,
  type TrainingBackendCapability,
  type TrainingMethod,
} from "@/features/finetune/training-capabilities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const backendId = params.get("backend") as TrainingBackendCapability["id"] | null;
  const method = params.get("method") as TrainingMethod | null;
  const compatibility =
    backendId && method
      ? evaluateTrainingCompatibility({
          backendId,
          modelFamily: params.get("family") || "qwen",
          method,
          quantizationBits: Number(params.get("bits") || 4),
          scheduler: params.get("scheduler") || "cosine",
          distributed: params.get("distributed") === "true",
        })
      : null;
  return NextResponse.json({ ...readTrainingCapabilityRegistry(), compatibility });
}
