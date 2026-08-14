import { NextResponse } from "next/server";

import {
  acceptIdentityEventDelivery,
  IdentityEventDeliveryError,
  readIdentityEventDeliveryEvidence,
} from "@/features/governance/identity-event-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readIdentityEventDeliveryEvidence());
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const delivery = acceptIdentityEventDelivery({
      deliveryId: request.headers.get("x-first-llm-delivery-id") || "",
      timestamp: Number(request.headers.get("x-first-llm-timestamp")),
      signature: request.headers.get("x-first-llm-signature") || "",
      body,
    });
    return NextResponse.json({
      ok: true,
      delivery,
      evidence: readIdentityEventDeliveryEvidence(),
    });
  } catch (error) {
    const status = error instanceof IdentityEventDeliveryError ? error.status : 400;
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Identity event delivery failed.",
      },
      { status },
    );
  }
}
