import { NextResponse } from "next/server";
import type {
  ExperimentEventKind,
  ExperimentEventStatus,
  ExperimentTimelineResponse,
} from "@/features/experiments/contracts";
import {
  getExperimentTimelineFilePath,
  readExperimentTimeline,
} from "@/features/experiments/timeline-service";
import { applyExperimentRetention } from "@/features/experiments/retention-service";
import type { ExperimentRetentionPolicy } from "@/features/experiments/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMELINE_KINDS: ExperimentEventKind[] = [
  "session",
  "compare",
  "benchmark",
  "finetune",
  "retrieval",
  "model",
  "provider",
];
const TIMELINE_STATUSES: ExperimentEventStatus[] = [
  "started",
  "saved",
  "completed",
  "failed",
  "cancelled",
  "conflict",
];

function parseMultiValue<T extends string>(value: string | null, allowed: T[]) {
  if (!value) return undefined;
  const normalized = value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is T => allowed.includes(item as T));
  return normalized.length ? normalized : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") || "30");
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(limitParam, 200))
    : 30;
  const kinds = parseMultiValue(searchParams.get("kind"), TIMELINE_KINDS);
  const statuses = parseMultiValue(
    searchParams.get("status"),
    TIMELINE_STATUSES,
  );
  const response: ExperimentTimelineResponse = {
    ok: true,
    generatedAt: new Date().toISOString(),
    path: getExperimentTimelineFilePath(),
    events: readExperimentTimeline({ limit, kinds, statuses }),
  };
  return NextResponse.json(response);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: string;
      policy?: Partial<ExperimentRetentionPolicy>;
    };
    if (body.action !== "apply-retention") {
      return NextResponse.json({ error: "Unknown experiment action." }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      retention: applyExperimentRetention(body.policy),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Retention failed." },
      { status: 400 },
    );
  }
}
