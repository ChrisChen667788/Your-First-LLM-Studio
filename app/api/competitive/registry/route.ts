import { NextResponse } from "next/server";

import {
  readCompetitiveSourceRegistry,
  refreshCompetitiveSourceRegistry,
} from "@/features/competitive/source-registry";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(readCompetitiveSourceRegistry());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const body = await request.json().catch(() => ({})) as { sourceIds?: unknown };
    const sourceIds = Array.isArray(body.sourceIds)
      ? body.sourceIds.filter((entry): entry is string => typeof entry === "string")
      : undefined;
    return NextResponse.json(await refreshCompetitiveSourceRegistry({ sourceIds }));
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
