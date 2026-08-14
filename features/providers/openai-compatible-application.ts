import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { runProviderCompletion } from "@/features/providers/provider-port";
import { resolveTarget } from "@/lib/agent/providers";
import { listServerAgentTargets } from "@/lib/agent/server-targets";
import type { AgentMessage } from "@/lib/agent/types";

type OpenAIMessage = {
  role?: unknown;
  content?: unknown;
};

type OpenAIChatBody = {
  model?: unknown;
  messages?: unknown;
  stream?: unknown;
  stream_options?: { include_usage?: unknown };
  max_tokens?: unknown;
  max_completion_tokens?: unknown;
  temperature?: unknown;
  top_p?: unknown;
};

function contentText(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const value = part as { type?: unknown; text?: unknown };
      return value.type === "text" && typeof value.text === "string"
        ? value.text
        : "";
    })
    .filter(Boolean)
    .join("\n");
}

function assertPublicApiAuthorization(request: Request) {
  const expected = process.env.FIRST_LLM_PUBLIC_API_KEY?.trim();
  if (!expected) return;
  const received =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw Object.assign(new Error("Invalid public API bearer token."), {
      status: 401,
    });
  }
}

function resolvePublicTargetId(requestedModel: string | null) {
  const targets = listServerAgentTargets();
  const fallbackTargetId =
    process.env.FIRST_LLM_PUBLIC_DEFAULT_TARGET_ID || "local-qwen3-0.6b";
  if (!requestedModel) return fallbackTargetId;
  const match = targets.find(
    (target) =>
      target.id === requestedModel ||
      target.modelDefault === requestedModel ||
      target.thinkingModelDefault === requestedModel,
  );
  if (!match) {
    throw Object.assign(
      new Error(`Unknown public model or target: ${requestedModel}`),
      { status: 404 },
    );
  }
  return match.id;
}

function normalizeChatBody(body: OpenAIChatBody) {
  if (!Array.isArray(body.messages) || !body.messages.length) {
    throw Object.assign(new Error("messages must be a non-empty array."), {
      status: 400,
    });
  }
  const messages = body.messages as OpenAIMessage[];
  const normalized = messages.map((message) => ({
    role: typeof message?.role === "string" ? message.role : "",
    content: contentText(message?.content),
  }));
  const lastUserIndex = normalized.findLastIndex(
    (message) => message.role === "user" && message.content.trim(),
  );
  if (lastUserIndex < 0) {
    throw Object.assign(new Error("A text user message is required."), {
      status: 400,
    });
  }
  const history = normalized
    .slice(0, lastUserIndex)
    .filter(
      (message): message is AgentMessage =>
        (message.role === "user" || message.role === "assistant") &&
        Boolean(message.content.trim()),
    );
  const systemPrompt = normalized
    .filter((message) => message.role === "system" && message.content.trim())
    .map((message) => message.content.trim())
    .join("\n\n");
  const requestedModel =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : null;
  const maxTokensValue =
    typeof body.max_completion_tokens === "number"
      ? body.max_completion_tokens
      : body.max_tokens;
  return {
    targetId: resolvePublicTargetId(requestedModel),
    requestedModel,
    input: normalized[lastUserIndex].content,
    messages: history,
    systemPrompt,
    stream: body.stream === true,
    includeUsage: body.stream_options?.include_usage === true,
    maxTokens:
      typeof maxTokensValue === "number" ? maxTokensValue : undefined,
    temperature:
      typeof body.temperature === "number" ? body.temperature : undefined,
    topP: typeof body.top_p === "number" ? body.top_p : undefined,
  };
}

function completionPayload(result: Awaited<ReturnType<typeof runProviderCompletion>>) {
  const promptTokens = result.usage?.promptTokens || 0;
  const completionTokens = result.usage?.completionTokens || 0;
  return {
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: "chat.completion" as const,
    created: Math.floor(Date.now() / 1000),
    model: result.resolvedModel,
    choices: [
      {
        index: 0,
        message: { role: "assistant" as const, content: result.content },
        finish_reason: "stop" as const,
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens:
        result.usage?.totalTokens || promptTokens + completionTokens,
    },
    system_fingerprint: result.targetLabel,
    ...(result.warning ? { warning: result.warning } : {}),
  };
}

function completionStream(
  payload: ReturnType<typeof completionPayload>,
  includeUsage: boolean,
) {
  const encoder = new TextEncoder();
  const chunks = payload.choices[0].message.content.match(/[\s\S]{1,96}/g) || [];
  const stream = new ReadableStream({
    start(controller) {
      const emit = (value: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
      emit({
        id: payload.id,
        object: "chat.completion.chunk",
        created: payload.created,
        model: payload.model,
        choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
      });
      for (const content of chunks) {
        emit({
          id: payload.id,
          object: "chat.completion.chunk",
          created: payload.created,
          model: payload.model,
          choices: [{ index: 0, delta: { content }, finish_reason: null }],
        });
      }
      emit({
        id: payload.id,
        object: "chat.completion.chunk",
        created: payload.created,
        model: payload.model,
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        ...(includeUsage ? { usage: payload.usage } : {}),
      });
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function handleOpenAICompatibleChatCompletion(
  request: Request,
  dependencies: { runCompletion: typeof runProviderCompletion } = {
    runCompletion: runProviderCompletion,
  },
) {
  try {
    assertPublicApiAuthorization(request);
    const body = (await request.json().catch(() => ({}))) as OpenAIChatBody;
    const normalized = normalizeChatBody(body);
    const result = await dependencies.runCompletion({
      targetId: normalized.targetId,
      input: normalized.input,
      messages: normalized.messages,
      systemPrompt: normalized.systemPrompt || undefined,
      maxTokens: normalized.maxTokens,
      temperature: normalized.temperature,
      topP: normalized.topP,
      operation: "public-v1-chat-completion",
    });
    const payload = completionPayload(result);
    return normalized.stream
      ? completionStream(payload, normalized.includeUsage)
      : NextResponse.json(payload);
  } catch (error) {
    const candidate = error as { status?: unknown };
    const message =
      error instanceof Error ? error.message : "Provider completion failed.";
    const status =
      typeof candidate.status === "number"
        ? candidate.status
        : /Missing .*API_KEY|offline|not become ready/i.test(message)
          ? 503
          : 502;
    return NextResponse.json(
      { error: { message, type: "provider_error" } },
      { status },
    );
  }
}

export function listPublicOpenAIModels() {
  return listServerAgentTargets().map((target) => {
    let resolvedModel = target.modelDefault;
    let configured = target.execution === "local";
    try {
      const resolved = resolveTarget(target.id);
      resolvedModel = resolved.resolvedModel;
      configured = Boolean(resolved.resolvedApiKey) || target.execution === "local";
    } catch {
      configured = false;
    }
    return {
      id: target.id,
      object: "model" as const,
      created: 0,
      owned_by: target.providerLabel,
      root: resolvedModel,
      configured,
    };
  });
}
