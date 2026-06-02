import { buildReproduceRequestArtifacts } from "@/lib/agent/reproduce-request";
import type {
  AgentCompareIntent,
  AgentCompareOutputShape,
  AgentCompareResponse,
  AgentMessage,
  AgentProviderProfile,
  AgentThinkingMode,
} from "@/lib/agent/types";

export function buildCompareReproduceRequestArtifacts(input: {
  compareTargetIds: string[];
  input: string;
  historyMessages: AgentMessage[];
  systemPrompt: string;
  compareIntent: AgentCompareIntent;
  compareOutputShape: AgentCompareOutputShape;
  contextWindow: number;
  enableTools: boolean;
  enableRetrieval: boolean;
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
  compareResult?: AgentCompareResponse | null;
}) {
  return buildReproduceRequestArtifacts({
    mode: "compare",
    compareTargetIds: input.compareTargetIds,
    input: input.input,
    historyMessages: input.historyMessages,
    systemPrompt: input.systemPrompt,
    compareIntent: input.compareIntent,
    compareOutputShape: input.compareOutputShape,
    contextWindow: input.contextWindow,
    enableTools: input.enableTools,
    enableRetrieval: input.enableRetrieval,
    providerProfile: input.providerProfile,
    thinkingMode: input.thinkingMode,
    compareResult: input.compareResult,
  });
}
