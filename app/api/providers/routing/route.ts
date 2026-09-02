import { NextResponse } from "next/server";

import {
  buildWorkloadRoutingScorecard,
  readWorkloadRoutingReadModel,
  type RoutingCandidateInput,
  type RoutingWorkload,
} from "@/features/providers/workload-routing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(readWorkloadRoutingReadModel());
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      workload?: RoutingWorkload;
      candidates?: RoutingCandidateInput[];
      policy?: Parameters<typeof buildWorkloadRoutingScorecard>[0]["policy"];
    };
    if (!body.workload || !Array.isArray(body.candidates)) {
      return NextResponse.json(
        { ok: false, error: "workload and candidates are required." },
        { status: 400 },
      );
    }
    return NextResponse.json({
      ok: true,
      ...buildWorkloadRoutingScorecard({
        workload: body.workload,
        candidates: body.candidates,
        policy: body.policy,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
