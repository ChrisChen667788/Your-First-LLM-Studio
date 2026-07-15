import { NextResponse } from "next/server";
import {
  readRouteSmokeEvidence,
  serializeRouteSmokeEvidenceAsMarkdown,
} from "@/features/experiments/route-smoke-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format") || "json";
  if (format === "md") {
    return new NextResponse(serializeRouteSmokeEvidenceAsMarkdown(), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": "attachment; filename=route-smoke-evidence.md",
      },
    });
  }
  return new NextResponse(`${JSON.stringify(readRouteSmokeEvidence(), null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": "attachment; filename=route-smoke-evidence.json",
    },
  });
}
