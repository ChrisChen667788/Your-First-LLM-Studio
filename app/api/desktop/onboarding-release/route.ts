import { NextResponse } from "next/server";

import {
  readDesktopOnboardingRelease,
  rehearseDesktopOnboardingRelease,
} from "@/features/desktop/onboarding-release";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readDesktopOnboardingRelease());
}

export async function POST() {
  try {
    return NextResponse.json({ ok: true, ...rehearseDesktopOnboardingRelease() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Desktop onboarding rehearsal failed." },
      { status: 500 },
    );
  }
}
