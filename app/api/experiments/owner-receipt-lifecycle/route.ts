import { NextResponse } from "next/server";

import {
  mutateOwnerReceiptIntakeApplication,
  readOwnerReceiptIntakeApplication,
  type OwnerReceiptMutationBody,
} from "@/features/experiments/owner-receipt-lifecycle-application";
import { OwnerReceiptLifecycleError } from "@/features/experiments/owner-receipt-lifecycle";
import { assertTrustedOperatorRequest, operatorAuthorizationStatus } from "@/features/security/operator-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(readOwnerReceiptIntakeApplication());
  } catch (error) {
    return NextResponse.json({
      ok: false,
      sourceStatus: "pass",
      externalStatus: "hold",
      productionStatus: "blocked",
      error: error instanceof Error ? error.message : "Owner receipt lifecycle evidence could not be read.",
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const body = await request.json().catch(() => ({})) as OwnerReceiptMutationBody;
    return NextResponse.json({ ok: true, ...mutateOwnerReceiptIntakeApplication(body) }, { status: 201 });
  } catch (error) {
    const status = error instanceof OwnerReceiptLifecycleError
      ? error.status
      : operatorAuthorizationStatus(error);
    return NextResponse.json({
      ok: false,
      sourceStatus: "pass",
      externalStatus: "hold",
      productionStatus: "blocked",
      error: error instanceof Error ? error.message : "Owner receipt lifecycle action failed.",
    }, { status });
  }
}

