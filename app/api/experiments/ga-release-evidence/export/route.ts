import { NextResponse } from "next/server";
import {
  buildGaReleaseEvidenceBundle,
  serializeGaReleaseEvidenceBundleAsMarkdown,
} from "@/features/experiments/ga-release-evidence-bundle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format") || "json";
  const bundle = buildGaReleaseEvidenceBundle();
  if (format === "md") {
    return new NextResponse(serializeGaReleaseEvidenceBundleAsMarkdown(bundle), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": "attachment; filename=ga-release-evidence.md",
      },
    });
  }
  return new NextResponse(`${JSON.stringify(bundle, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": "attachment; filename=ga-release-evidence.json",
    },
  });
}
