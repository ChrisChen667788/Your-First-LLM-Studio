import { NextResponse } from "next/server";

import {
  readEnterpriseIdpAdapterReadiness,
  runEnterpriseIdpAdapter,
} from "@/features/governance/enterprise-idp-adapter";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readEnterpriseIdpAdapterReadiness());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const body = await request.json().catch(() => ({})) as {
      action?: "probe" | "sync";
    };
    const receipt = await runEnterpriseIdpAdapter({
      sync: body.action === "sync",
    });
    return NextResponse.json(
      {
        ok: receipt.status === "pass",
        receipt,
        evidence: readEnterpriseIdpAdapterReadiness(),
      },
      { status: receipt.status === "pass" ? 200 : 422 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Enterprise IdP action failed.",
        evidence: readEnterpriseIdpAdapterReadiness(),
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
