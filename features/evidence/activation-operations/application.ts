import { NextResponse } from "next/server";
import { z } from "zod";
import { assertTrustedOperatorRequest, OperatorAuthorizationError } from "@/features/security/operator-auth";
import { DurableJsonStoreError } from "@/features/persistence/durable-json-store";
import { ActivationOperationsError, operationsDigestSchema, operationsIdentitySchema } from "./contracts";
import { createActivationOperationsService } from "./service";

const commandSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("preflight-rotation"), envelopeDigest: operationsDigestSchema }),
  z.strictObject({ action: z.literal("admit-rotation"), envelopeDigest: operationsDigestSchema, expectedRevision: z.number().int().nonnegative() }),
  z.strictObject({ action: z.literal("claim-quarantine"), caseId: operationsDigestSchema, expectedRevision: z.number().int().nonnegative() }),
  z.strictObject({ action: z.literal("release-quarantine"), caseId: operationsDigestSchema, expectedRevision: z.number().int().nonnegative() }),
  z.strictObject({ action: z.literal("admit-decision"), envelopeDigest: operationsDigestSchema, expectedRevision: z.number().int().nonnegative() }),
  z.strictObject({ action: z.literal("restore"), expectedRevision: z.number().int().nonnegative(), bundle: z.unknown() }),
]);
const MAX_BODY_BYTES = 2 * 1024 * 1024;

async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new ActivationOperationsError("schema-invalid", 415);
  const reader = request.body?.getReader(); if (!reader) throw new ActivationOperationsError("schema-invalid", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new ActivationOperationsError("capacity-exceeded", 413); } chunks.push(value); } return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch (error) { if (error instanceof ActivationOperationsError) throw error; throw new ActivationOperationsError("schema-invalid", 400); }
  finally { reader.releaseLock(); }
}

function failure(error: unknown) {
  const code = error instanceof ActivationOperationsError ? error.code : error instanceof OperatorAuthorizationError ? "unauthorized" : error instanceof DurableJsonStoreError && error.code === "store_locked" ? "revision-conflict" : "ledger-invalid";
  const status = error instanceof ActivationOperationsError ? error.status : code === "unauthorized" ? 401 : code === "revision-conflict" ? 409 : 503;
  return NextResponse.json({ ok: false, code, error: `Activation operations: ${code}.` }, { status, headers: { "cache-control": "no-store" } });
}

function operatorId(request: Request) {
  const value = request.headers.get("x-first-llm-operator-id")?.trim() || "";
  if (!operationsIdentitySchema.safeParse(value).success) throw new ActivationOperationsError("schema-invalid", 400);
  return value;
}

export function createActivationOperationsHandlers(service = createActivationOperationsService()) {
  return {
    async GET(request: Request) {
      try {
        const url = new URL(request.url);
        if (url.searchParams.get("export") === "true") { assertTrustedOperatorRequest(request); return NextResponse.json(service.exportBundle(), { headers: { "cache-control": "no-store", "content-disposition": "attachment; filename=activation-operations-export.json" } }); }
        return NextResponse.json(service.summary(), { headers: { "cache-control": "no-store" } });
      } catch (error) { return failure(error); }
    },
    async POST(request: Request) {
      try {
        assertTrustedOperatorRequest(request);
        const origin = request.headers.get("origin"); if (origin && origin !== new URL(request.url).origin) throw new OperatorAuthorizationError("Cross-origin operations denied.");
        const parsed = commandSchema.safeParse(await readJson(request)); if (!parsed.success) throw new ActivationOperationsError("schema-invalid", 400);
        const command = parsed.data;
        if (command.action === "preflight-rotation") return NextResponse.json(service.preflightRotation(command.envelopeDigest));
        if (command.action === "admit-rotation") return NextResponse.json(service.admitRotation(command.envelopeDigest, command.expectedRevision));
        if (command.action === "admit-decision") return NextResponse.json(service.admitDecision(command.envelopeDigest, command.expectedRevision));
        const ownerId = operatorId(request);
        if (command.action === "claim-quarantine") return NextResponse.json(service.claimQuarantine(command.caseId, ownerId, command.expectedRevision));
        if (command.action === "release-quarantine") return NextResponse.json(service.releaseQuarantine(command.caseId, ownerId, command.expectedRevision));
        return NextResponse.json(service.restoreBundle(command.bundle, command.expectedRevision));
      } catch (error) { return failure(error); }
    },
  };
}
