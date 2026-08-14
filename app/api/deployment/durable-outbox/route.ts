import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import {
  PostgresUsageOutboxAdapter,
  readPostgresUsageOutboxEvidence,
} from "@/features/deployment/postgres-usage-outbox";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readPostgresUsageOutboxEvidence());
}

export async function POST(request: Request) {
  let adapter: PostgresUsageOutboxAdapter | null = null;
  try {
    assertTrustedOperatorRequest(request);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    adapter = new PostgresUsageOutboxAdapter();
    await adapter.ensureSchema();
    const event = await adapter.enqueue({
      idempotencyKey: String(body.idempotencyKey || ""),
      tenantId: String(body.tenantId || ""),
      promptTokens: Number(body.promptTokens || 0),
      completionTokens: Number(body.completionTokens || 0),
      payloadDigest: typeof body.payloadDigest === "string"
        ? body.payloadDigest
        : createHash("sha256").update(JSON.stringify(body)).digest("hex"),
    });
    return NextResponse.json({ ok: true, event, summary: await adapter.readSummary() }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Durable usage outbox failed." },
      { status: operatorAuthorizationStatus(error) },
    );
  } finally {
    await adapter?.close().catch(() => undefined);
  }
}
