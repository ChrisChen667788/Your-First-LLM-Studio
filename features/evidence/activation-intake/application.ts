import { NextResponse } from "next/server";
import { z } from "zod";
import { assertTrustedOperatorRequest, OperatorAuthorizationError } from "@/features/security/operator-auth";
import { DurableJsonStoreError } from "@/features/persistence/durable-json-store";
import { ActivationIntakeError, importSchema } from "./contracts";
import { createActivationIntakeService, registerIntakeManifest } from "./service";

const commandSchema = z.union([importSchema,
  z.strictObject({ action: z.literal("restore"), expectedRevision: z.number().int().nonnegative(), backup: z.unknown() }),
  z.strictObject({ action: z.literal("register-manifest"), manifest: z.unknown() }),
]);
const MAX_BODY_BYTES = 2 * 1024 * 1024;

export async function readIntakeRequest(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new ActivationIntakeError("schema-invalid", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new ActivationIntakeError("schema-invalid", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new ActivationIntakeError("capacity-exceeded", 413); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof ActivationIntakeError) throw error;
    throw new ActivationIntakeError("schema-invalid", 400);
  } finally { reader.releaseLock(); }
}

function failure(error: unknown) {
  const code = error instanceof ActivationIntakeError ? error.code : error instanceof OperatorAuthorizationError ? "unauthorized"
    : error instanceof DurableJsonStoreError && error.code === "store_locked" ? "revision-conflict" : "ledger-invalid";
  const status = error instanceof ActivationIntakeError ? error.status : code === "unauthorized" ? 401 : code === "revision-conflict" ? 409 : 503;
  return NextResponse.json({ ok: false, code, error: `Evidence intake: ${code}.` }, { status, headers: { "cache-control": "no-store" } });
}

export function createIntakeHandlers(service = createActivationIntakeService()) {
  return {
    async GET(request: Request) {
      try {
        if (new URL(request.url).searchParams.get("export") === "true") {
          assertTrustedOperatorRequest(request);
          return NextResponse.json(service.backup(), { headers: { "cache-control": "no-store", "content-disposition": "attachment; filename=activation-intake-backup.json" } });
        }
        return NextResponse.json(service.summary(), { headers: { "cache-control": "no-store" } });
      } catch (error) { return failure(error); }
    },
    async POST(request: Request) {
      try {
        assertTrustedOperatorRequest(request);
        const origin = request.headers.get("origin");
        if (origin && origin !== new URL(request.url).origin) throw new OperatorAuthorizationError("Cross-origin intake denied.");
        const parsed = commandSchema.safeParse(await readIntakeRequest(request));
        if (!parsed.success) throw new ActivationIntakeError("schema-invalid", 400);
        const command = parsed.data;
        if (command.action === "register-manifest") return NextResponse.json({ ok: true, manifest: registerIntakeManifest(command.manifest) });
        if (command.action === "restore") return NextResponse.json(service.restore(command.backup, command.expectedRevision));
        const result = service.importBatch(command.envelopes, command.expectedRevision, command.dryRun);
        return NextResponse.json(result, { status: result.status });
      } catch (error) { return failure(error); }
    },
  };
}
