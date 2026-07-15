import { NextResponse } from "next/server";
import {
  readAdminCompatibilityDeletionManifest,
  serializeAdminCompatibilityDeletionRehearsalAsMarkdown,
} from "@/features/admin/compatibility-deletion-manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format") || "json";
  if (format === "md") {
    return new NextResponse(serializeAdminCompatibilityDeletionRehearsalAsMarkdown(), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition":
          "attachment; filename=admin-compatibility-pre-sunset-rehearsal.md",
      },
    });
  }
  return NextResponse.json(readAdminCompatibilityDeletionManifest(), {
    headers: {
      "Content-Disposition":
        "attachment; filename=admin-compatibility-pre-sunset-rehearsal.json",
    },
  });
}
