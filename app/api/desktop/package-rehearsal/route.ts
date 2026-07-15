import { NextResponse } from "next/server";
import {
  readDesktopPackageRehearsals,
  runDesktopPackageRehearsal,
} from "@/features/desktop/package-rehearsal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readDesktopPackageRehearsals());
}

export async function POST() {
  const report = runDesktopPackageRehearsal();
  return NextResponse.json({ ok: report.status === "pass", report, summary: readDesktopPackageRehearsals() }, { status: report.status === "pass" ? 200 : 500 });
}
