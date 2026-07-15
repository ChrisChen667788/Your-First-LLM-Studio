import { NextResponse } from "next/server";
import {
  readProviderOpsEvidenceSnapshots,
  serializeProviderOpsEvidenceSnapshotsAsMarkdown,
} from "@/features/providers/evidence-snapshot-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "md" ? "md" : "json";
  if (format === "md") {
    return new Response(serializeProviderOpsEvidenceSnapshotsAsMarkdown(), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="provider-ops-evidence-snapshots.md"',
      },
    });
  }
  return NextResponse.json({
    ok: true,
    store: readProviderOpsEvidenceSnapshots({ limit: 200 }),
  });
}
