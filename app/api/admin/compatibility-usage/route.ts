import { NextResponse } from "next/server";
import {
  clearAdminCompatibilityUsageSummary,
  readAdminCompatibilityUsageSummary,
} from "@/features/admin/compatibility-usage";
import { appendExperimentEvent } from "@/features/experiments/timeline-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    summary: readAdminCompatibilityUsageSummary(),
  });
}

export async function DELETE() {
  const result = clearAdminCompatibilityUsageSummary();
  appendExperimentEvent({
    kind: "provider",
    status: "completed",
    title: "Admin compatibility usage cleared",
    summary: `Cleared ${result.before.totalHits} deprecated Admin compatibility API hit${result.before.totalHits === 1 ? "" : "s"} across ${result.before.routeCount} route${result.before.routeCount === 1 ? "" : "s"}.`,
    artifacts: [
      {
        kind: "api",
        role: "manifest",
        label: "Admin compatibility usage",
        uri: "/api/admin/compatibility-usage",
      },
    ],
    metadata: {
      previousHits: result.before.totalHits,
      previousRoutes: result.before.routeCount,
      clearedAt: result.clearedAt,
    },
  });
  return NextResponse.json(result);
}
