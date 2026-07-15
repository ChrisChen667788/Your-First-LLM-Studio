import { NextResponse } from "next/server";
import {
  discoverOllamaModels,
  readOllamaHealth,
  runOllamaRuntimeAction,
} from "@/features/runtime/ollama-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const action = new URL(request.url).searchParams.get("action") || "health";
  return NextResponse.json(action === "discover" ? await discoverOllamaModels() : await readOllamaHealth());
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action === "unload" ? "unload" : "prewarm";
  try {
    const result = await runOllamaRuntimeAction({
      action,
      model: typeof body.model === "string" ? body.model : undefined,
      keepAlive: typeof body.keepAlive === "string" ? body.keepAlive : undefined,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Ollama action failed." }, { status: 400 });
  }
}
