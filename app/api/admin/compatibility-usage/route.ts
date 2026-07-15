import { NextResponse } from "next/server";
import {
  AdminCompatibilityApplicationError,
  clearAdminCompatibilityApplication,
  readAdminCompatibilityApplication,
  runAdminCompatibilityAction,
  type AdminCompatibilityActionInput,
} from "@/features/admin/compatibility-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readAdminCompatibilityApplication());
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as
    AdminCompatibilityActionInput;
  try {
    return NextResponse.json(runAdminCompatibilityAction(body));
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : "Compatibility usage action failed.",
      },
      {
        status: error instanceof AdminCompatibilityApplicationError
          ? error.status
          : 400,
      },
    );
  }
}

export async function DELETE() {
  return NextResponse.json(clearAdminCompatibilityApplication());
}
