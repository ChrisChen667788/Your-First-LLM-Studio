import assert from "node:assert/strict";
import test from "node:test";

import { handleOpenAICompatibleChatCompletion } from "@/features/providers/openai-compatible-application";
import { chunkEnterpriseDocument, resolveEnterpriseRetrievalConfig } from "@/features/retrieval/enterprise-service";
import { resolveTelemetryConfig } from "@/features/telemetry/trace-adapter";
import { resolveProviderCapabilityRoute } from "@/lib/agent/provider-capabilities";
import { agentTargets } from "@/lib/agent/catalog";
import type { ResolvedTarget } from "@/lib/agent/types";

function deepSeekTarget(): ResolvedTarget {
  const target = agentTargets.find((entry) => entry.id === "deepseek-api");
  assert.ok(target);
  return {
    ...target,
    resolvedApiKey: "test-key",
    resolvedBaseUrl: "https://api.deepseek.test/v1",
    resolvedModel: "deepseek-reasoner",
  };
}

test("DeepSeek capability routing selects account-advertised V4 and keeps Flash fallback", async () => {
  const route = await resolveProviderCapabilityRoute({
    target: deepSeekTarget(),
    thinkingMode: "standard",
    candidateModels: ["deepseek-v4-pro", "deepseek-v4-flash"],
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          data: [{ id: "deepseek-v4-flash" }, { id: "deepseek-v4-pro" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });

  assert.equal(route.probed, true);
  assert.equal(route.target.resolvedModel, "deepseek-v4-pro");
  assert.equal(route.fallbackTargets[0]?.resolvedModel, "deepseek-v4-flash");
});

test("public v1 chat completion returns a real Provider-port result instead of a fixed completion", async () => {
  const response = await handleOpenAICompatibleChatCompletion(
    new Request("http://127.0.0.1:3011/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-v4-pro",
        messages: [{ role: "user", content: "Return runtime evidence." }],
      }),
    }),
    {
      runCompletion: async () => ({
        content: "provider-port-evidence",
        providerLabel: "DeepSeek",
        targetLabel: "DeepSeek API",
        resolvedModel: "deepseek-v4-pro",
        resolvedBaseUrl: "https://api.deepseek.test/v1",
        toolRuns: [],
        execution: "remote",
        usage: { promptTokens: 4, completionTokens: 3, totalTokens: 7 },
      }),
    },
  );
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    model: string;
    usage: { total_tokens: number };
  };
  assert.equal(payload.choices[0].message.content, "provider-port-evidence");
  assert.equal(payload.model, "deepseek-v4-pro");
  assert.equal(payload.usage.total_tokens, 7);
});

test("enterprise Retrieval fails closed without services and chunks real document content", () => {
  const previous = {
    database: process.env.ENTERPRISE_RAG_DATABASE_URL,
    embeddingBase: process.env.ENTERPRISE_RAG_EMBEDDING_BASE_URL,
    embeddingModel: process.env.ENTERPRISE_RAG_EMBEDDING_MODEL,
    rerankerUrl: process.env.ENTERPRISE_RAG_RERANKER_URL,
    rerankerModel: process.env.ENTERPRISE_RAG_RERANKER_MODEL,
  };
  delete process.env.ENTERPRISE_RAG_DATABASE_URL;
  delete process.env.ENTERPRISE_RAG_EMBEDDING_BASE_URL;
  delete process.env.ENTERPRISE_RAG_EMBEDDING_MODEL;
  delete process.env.ENTERPRISE_RAG_RERANKER_URL;
  delete process.env.ENTERPRISE_RAG_RERANKER_MODEL;
  try {
    const config = resolveEnterpriseRetrievalConfig();
    assert.equal(config.ready, false);
    assert.ok(config.blockers.length >= 5);
    assert.ok(
      chunkEnterpriseDocument(`${"A".repeat(900)}\n\n${"B".repeat(900)}`).length >= 2,
    );
  } finally {
    if (previous.database) process.env.ENTERPRISE_RAG_DATABASE_URL = previous.database;
    if (previous.embeddingBase) process.env.ENTERPRISE_RAG_EMBEDDING_BASE_URL = previous.embeddingBase;
    if (previous.embeddingModel) process.env.ENTERPRISE_RAG_EMBEDDING_MODEL = previous.embeddingModel;
    if (previous.rerankerUrl) process.env.ENTERPRISE_RAG_RERANKER_URL = previous.rerankerUrl;
    if (previous.rerankerModel) process.env.ENTERPRISE_RAG_RERANKER_MODEL = previous.rerankerModel;
  }
});

test("telemetry adapter reports a strict disabled state without OTLP or Langfuse credentials", () => {
  const previousOtlp = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const previousBase = process.env.LANGFUSE_BASE_URL;
  const previousPublic = process.env.LANGFUSE_PUBLIC_KEY;
  const previousSecret = process.env.LANGFUSE_SECRET_KEY;
  delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  delete process.env.LANGFUSE_BASE_URL;
  delete process.env.LANGFUSE_PUBLIC_KEY;
  delete process.env.LANGFUSE_SECRET_KEY;
  try {
    const config = resolveTelemetryConfig();
    assert.equal(config.enabled, false);
    assert.equal(config.exporter, "disabled");
    assert.ok(config.blockers.length > 0);
  } finally {
    if (previousOtlp) process.env.OTEL_EXPORTER_OTLP_ENDPOINT = previousOtlp;
    if (previousBase) process.env.LANGFUSE_BASE_URL = previousBase;
    if (previousPublic) process.env.LANGFUSE_PUBLIC_KEY = previousPublic;
    if (previousSecret) process.env.LANGFUSE_SECRET_KEY = previousSecret;
  }
});
