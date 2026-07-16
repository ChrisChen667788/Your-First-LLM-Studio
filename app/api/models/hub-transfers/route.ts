import { NextResponse } from "next/server";
import {
  createHubTransferSession,
  finalizeHubTransferSession,
  readHubTransferSessions,
  runHubTransferSessionStep,
  resetHubTransferFileRetry,
} from "@/features/models/hub-transfer-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readHubTransferSessions());
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const result = body.action === "reset-retry"
      ? resetHubTransferFileRetry(String(body.sessionId || ""), String(body.jobId || ""))
      : body.action === "finalize"
      ? finalizeHubTransferSession(String(body.sessionId || ""), body.requireAuthentication !== false)
      : body.action === "transfer-step"
      ? await runHubTransferSessionStep(String(body.sessionId || ""), typeof body.chunkBytes === "number" ? body.chunkBytes : undefined)
      : await createHubTransferSession({
          provider: body.provider === "modelscope" ? "modelscope" : "hugging-face",
          repository: typeof body.repository === "string" ? body.repository : undefined,
          revision: typeof body.revision === "string" ? body.revision : undefined,
          destination: typeof body.destination === "string" ? body.destination : undefined,
          include: Array.isArray(body.include) ? body.include.filter((value): value is string => typeof value === "string") : undefined,
          exclude: Array.isArray(body.exclude) ? body.exclude.filter((value): value is string => typeof value === "string") : undefined,
          files: Array.isArray(body.files) ? body.files.filter((value): value is string => typeof value === "string") : undefined,
        });
    return NextResponse.json({ ok: true, result, registry: readHubTransferSessions() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Hub transfer failed." }, { status: 400 });
  }
}
