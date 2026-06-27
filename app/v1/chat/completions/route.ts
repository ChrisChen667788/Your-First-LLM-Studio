import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const model = typeof payload?.model === "string" ? payload.model : process.env.DEEPSEEK_MODEL ?? "deepseek-reasoner";

  return NextResponse.json({
    id: `chatcmpl-local-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content:
            "Local OpenAI-compatible gateway is reachable. Configure a production runtime adapter to proxy real model calls."
        },
        finish_reason: "stop"
      }
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }
  });
}
