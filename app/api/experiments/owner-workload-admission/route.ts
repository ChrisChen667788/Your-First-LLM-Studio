import { NextResponse } from "next/server";

import {
  readOwnerWorkloadAdmissionApplication,
  validateOwnerWorkloadReceiptApplication,
} from "@/features/experiments/owner-workload-admission-application";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(readOwnerWorkloadAdmissionApplication());
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        sourceStatus: "pass",
        externalStatus: "hold",
        productionStatus: "blocked",
        error: error instanceof Error ? error.message : "Owner workload admission evidence could not be read.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const validation = validateOwnerWorkloadReceiptApplication(body);
  return NextResponse.json(validation, { status: validation.ok ? 200 : 400 });
}
