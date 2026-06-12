import type { AgentTurn } from "@/features/agent/session-model";
import type {
  AgentCacheMode,
  AgentChatResponse,
  AgentGroundedVerification,
  AgentMessage,
  AgentProviderProfile,
  AgentRetrievalSummary,
  AgentThinkingMode,
  AgentToolDecisionResponse,
  AgentToolRun,
  AgentTarget,
} from "@/lib/agent/types";

export type AgentStreamEvent =
  | {
      type: "meta";
      targetId: string;
      targetLabel: string;
      providerLabel: string;
      resolvedModel: string;
      resolvedBaseUrl: string;
      execution: "local" | "remote";
      providerProfile?: AgentProviderProfile;
      thinkingMode?: AgentThinkingMode;
      thinkingFallbackToStandard?: boolean;
      localFallbackUsed?: boolean;
      localFallbackTargetId?: string;
      localFallbackTargetLabel?: string;
      localFallbackReason?: string;
      cacheHit?: boolean;
      cacheMode?: AgentCacheMode;
      plannerSteps?: string[];
      memorySummary?: string;
      retrieval?: AgentRetrievalSummary;
      verification?: AgentGroundedVerification;
    }
  | { type: "delta"; delta: string }
  | {
      type: "done";
      content: string;
      toolRuns?: AgentToolRun[];
      providerProfile?: AgentProviderProfile;
      thinkingMode?: AgentThinkingMode;
      thinkingFallbackToStandard?: boolean;
      localFallbackUsed?: boolean;
      localFallbackTargetId?: string;
      localFallbackTargetLabel?: string;
      localFallbackReason?: string;
      cacheHit?: boolean;
      cacheMode?: AgentCacheMode;
      plannerSteps?: string[];
      memorySummary?: string;
      retrieval?: AgentRetrievalSummary;
      verification?: AgentGroundedVerification;
      warning?: string;
    }
  | { type: "error"; error: string };

export type AgentChatRequestInput = {
  targetId: string;
  input: string;
  messages: AgentMessage[];
  systemPrompt: string;
  enableTools: boolean;
  enableRetrieval: boolean;
  contextWindow: number;
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
};

export function createPendingAgentTurn(input: {
  id: string;
  target: AgentTarget;
  prompt: string;
  displayPrompt?: string;
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
  replaySource?: AgentTurn["replaySource"];
}): AgentTurn {
  return {
    id: input.id,
    targetId: input.target.id,
    prompt: input.prompt,
    displayPrompt: input.displayPrompt || input.prompt,
    response: "",
    providerLabel: input.target.providerLabel,
    targetLabel: input.target.label,
    resolvedModel: input.target.modelDefault,
    resolvedBaseUrl: input.target.baseUrlDefault,
    providerProfile:
      input.target.execution === "remote" ? input.providerProfile : undefined,
    thinkingMode:
      input.target.execution === "remote" ? input.thinkingMode : undefined,
    thinkingFallbackToStandard: false,
    localFallbackUsed: false,
    cacheHit: false,
    toolRuns: [],
    replaySource: input.replaySource,
  };
}

export function applyAgentStreamEvent(
  turn: AgentTurn,
  event: AgentStreamEvent,
  noAssistantContent: string,
): AgentTurn {
  if (event.type === "delta") {
    return { ...turn, response: `${turn.response}${event.delta}` };
  }
  if (event.type === "meta") {
    return {
      ...turn,
      providerLabel: event.providerLabel,
      targetLabel: event.targetLabel,
      resolvedModel: event.resolvedModel,
      resolvedBaseUrl: event.resolvedBaseUrl,
      providerProfile: event.providerProfile,
      thinkingMode: event.thinkingMode,
      thinkingFallbackToStandard: event.thinkingFallbackToStandard,
      localFallbackUsed: event.localFallbackUsed,
      localFallbackTargetId: event.localFallbackTargetId,
      localFallbackTargetLabel: event.localFallbackTargetLabel,
      localFallbackReason: event.localFallbackReason,
      cacheHit: event.cacheHit,
      cacheMode: event.cacheMode,
      plannerSteps: event.plannerSteps,
      memorySummary: event.memorySummary,
      retrieval: event.retrieval,
      verification: event.verification,
    };
  }
  if (event.type === "done") {
    return {
      ...turn,
      response: event.content || turn.response || event.warning || noAssistantContent,
      toolRuns: event.toolRuns || [],
      providerProfile: event.providerProfile || turn.providerProfile,
      thinkingMode: event.thinkingMode || turn.thinkingMode,
      thinkingFallbackToStandard:
        event.thinkingFallbackToStandard ?? turn.thinkingFallbackToStandard,
      localFallbackUsed: event.localFallbackUsed ?? turn.localFallbackUsed,
      localFallbackTargetId:
        event.localFallbackTargetId || turn.localFallbackTargetId,
      localFallbackTargetLabel:
        event.localFallbackTargetLabel || turn.localFallbackTargetLabel,
      localFallbackReason: event.localFallbackReason || turn.localFallbackReason,
      cacheHit: event.cacheHit ?? turn.cacheHit,
      cacheMode: event.cacheMode || turn.cacheMode,
      plannerSteps: event.plannerSteps || turn.plannerSteps,
      memorySummary: event.memorySummary || turn.memorySummary,
      retrieval: event.retrieval || turn.retrieval,
      verification: event.verification || turn.verification,
      warning: event.warning,
    };
  }
  return turn;
}

export async function streamAgentPrompt(input: {
  request: AgentChatRequestInput;
  requestFailed: string;
  onEvent: (event: AgentStreamEvent) => void;
}) {
  const response = await fetch("/api/agent/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input.request),
  });
  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error || input.requestFailed);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error(input.requestFailed);

  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let lineBreak = buffer.indexOf("\n");
    while (lineBreak !== -1) {
      const line = buffer.slice(0, lineBreak).trim();
      buffer = buffer.slice(lineBreak + 1);
      if (line) {
        const event = JSON.parse(line) as AgentStreamEvent;
        if (event.type === "error") {
          throw new Error(event.error || input.requestFailed);
        }
        input.onEvent(event);
      }
      lineBreak = buffer.indexOf("\n");
    }
  }
}

export async function runAgentResumeRequest(
  request: AgentChatRequestInput,
  requestFailed: string,
) {
  const response = await fetch("/api/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const data = (await response.json()) as AgentChatResponse & { error?: string };
  if (!response.ok) throw new Error(data.error || requestFailed);
  return data;
}

export async function submitAgentToolDecision(input: {
  targetId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  confirmationToken: string;
  action: "approve" | "reject";
  requestFailed: string;
}) {
  const response = await fetch("/api/agent/tool/decision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetId: input.targetId,
      toolName: input.toolName,
      input: input.toolInput,
      confirmationToken: input.confirmationToken,
      action: input.action,
    }),
  });
  const data = (await response.json()) as AgentToolDecisionResponse & {
    error?: string;
  };
  if (!response.ok) throw new Error(data.error || input.requestFailed);
  return data;
}
