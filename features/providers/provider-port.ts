import { runAgentRequest } from "@/lib/agent/providers";
import type {
  AgentMessage,
  AgentProviderProfile,
  AgentThinkingMode,
} from "@/lib/agent/types";
import { withTelemetrySpan } from "@/features/telemetry/trace-adapter";

export const PROVIDER_COMPLETION_PORT_SCHEMA_VERSION =
  "providers.completion-port.v1" as const;

export type ProviderCompletionInput = {
  targetId: string;
  input: string;
  messages?: AgentMessage[];
  systemPrompt?: string;
  contextWindow?: number;
  providerProfile?: AgentProviderProfile;
  thinkingMode?: AgentThinkingMode;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  operation?: string;
};

export async function runProviderCompletion(input: ProviderCompletionInput) {
  return withTelemetrySpan(
    "llm.provider.completion",
    {
      "llm.target.id": input.targetId,
      "llm.operation": input.operation || "completion",
      "llm.tools.enabled": false,
    },
    () =>
      runAgentRequest(
        {
          targetId: input.targetId,
          input: input.input,
          messages: input.messages || [],
          enableTools: false,
          enableRetrieval: false,
          contextWindow: input.contextWindow,
          providerProfile: input.providerProfile,
          thinkingMode: input.thinkingMode,
          disableLocalFallback: false,
          maxTokens: input.maxTokens,
          temperature: input.temperature,
          topP: input.topP,
        },
        input.systemPrompt ||
          "You are a precise model runtime. Follow the user request and return only the requested answer.",
      ),
  );
}
