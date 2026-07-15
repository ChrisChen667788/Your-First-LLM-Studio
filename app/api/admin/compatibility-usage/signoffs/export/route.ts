import { NextResponse } from "next/server";
import {
  readAdminCompatibilityDeletionSignoffs,
  serializeAdminCompatibilityDeletionSignoffsAsMarkdown,
} from "@/features/admin/compatibility-deletion-signoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format") || "json";
  if (format === "md") {
    return new NextResponse(serializeAdminCompatibilityDeletionSignoffsAsMarkdown(), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": "attachment; filename=admin-compatibility-deletion-signoffs.md",
      },
    });
  }
  return new NextResponse(
    `${JSON.stringify(readAdminCompatibilityDeletionSignoffs(), null, 2)}\n`,
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=admin-compatibility-deletion-signoffs.json",
      },
    },
  );
}
