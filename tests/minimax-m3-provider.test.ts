import assert from "node:assert/strict";
import test from "node:test";

import { agentTargets } from "@/lib/agent/catalog";
import { getRemoteBenchmarkProviderKind } from "@/lib/agent/benchmark-remote-policy";
import { buildConnectionCheckDocsUrl } from "@/lib/agent/connection-check";
import {
  buildOpenAICompatibleRequestShape,
  buildOpenAICompatibleTokenLimit,
  getOpenAICompatibleProviderFamily,
} from "@/lib/agent/providers";
import type { ResolvedTarget } from "@/lib/agent/types";

function getMiniMaxTarget(): ResolvedTarget {
  const target = agentTargets.find((entry) => entry.id === "minimax-m3");
  assert.ok(target, "MiniMax M3 must be present in the shared target catalog");
  return {
    ...target,
    resolvedBaseUrl: target.baseUrlDefault,
    resolvedModel: target.modelDefault,
    resolvedApiKey: "test-only-key",
  };
}

test("MiniMax target is pinned to the official M3 OpenAI-compatible contract", () => {
  const target = getMiniMaxTarget();

  assert.equal(target.modelDefault, "MiniMax-M3");
  assert.equal(target.thinkingModelDefault, "MiniMax-M3");
  assert.equal(target.baseUrlDefault, "https://api.minimaxi.com/v1");
  assert.equal(target.apiKeyEnv, "MINIMAX_API_KEY");
  assert.equal(getOpenAICompatibleProviderFamily(target), "minimax");
  assert.equal(getRemoteBenchmarkProviderKind(target), "minimax-compatible");
  assert.equal(
    buildConnectionCheckDocsUrl(target.id),
    "https://platform.minimaxi.com/docs/api-reference/text-chat-openai",
  );
});

test("MiniMax M3 request modes use adaptive thinking and completion token limits", () => {
  const target = getMiniMaxTarget();
  const standard = buildOpenAICompatibleRequestShape({
    target,
    input: "Reply directly.",
    enableTools: false,
    thinkingMode: "standard",
  });
  const thinking = buildOpenAICompatibleRequestShape({
    target,
    input: "Solve this carefully.",
    enableTools: true,
    thinkingMode: "thinking",
  });

  assert.deepEqual(standard.bodyExtras.thinking, { type: "disabled" });
  assert.deepEqual(thinking.bodyExtras.thinking, { type: "adaptive" });
  assert.equal(standard.bodyExtras.reasoning_split, true);
  assert.equal(thinking.bodyExtras.reasoning_split, true);
  assert.deepEqual(buildOpenAICompatibleTokenLimit(target, 512), {
    max_completion_tokens: 512,
  });
});
