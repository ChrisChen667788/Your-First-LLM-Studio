"use client";

import type {
  Dispatch,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
  SetStateAction,
} from "react";
import {
  applyAgentStreamEvent,
  createPendingAgentTurn,
  runAgentResumeRequest,
  streamAgentPrompt,
  submitAgentToolDecision,
} from "@/features/agent/chat-actions";
import {
  flattenTurns,
  type AgentTurn,
} from "@/features/agent/session-model";
import type { AgentReplayTargetMode } from "@/features/agent/copy-replay-state";
import { parseToolOutput, readStringField } from "@/features/compare/review";
import type {
  AgentProviderProfile,
  AgentTarget,
  AgentThinkingMode,
  AgentToolRun,
} from "@/lib/agent/types";

type TurnLifecycleText = {
  requestFailed: string;
  resumeFailed: string;
  toolDecisionFailed: string;
  noAssistantContent: string;
};

export type TurnLifecycleInput = {
  locale: string;
  text: TurnLifecycleText;
  agentTargets: AgentTarget[];
  selectedTarget: AgentTarget;
  selectedTargetId: string;
  setSelectedTargetId: Dispatch<SetStateAction<string>>;
  turns: AgentTurn[];
  setTurns: Dispatch<SetStateAction<AgentTurn[]>>;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  systemPrompt: string;
  enableTools: boolean;
  enableRetrieval: boolean;
  setEnableRetrieval: Dispatch<SetStateAction<boolean>>;
  contextWindow: number;
  providerProfile: AgentProviderProfile;
  setProviderProfile: Dispatch<SetStateAction<AgentProviderProfile>>;
  thinkingMode: AgentThinkingMode;
  setThinkingMode: Dispatch<SetStateAction<AgentThinkingMode>>;
  pending: boolean;
  setPending: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  replayTargetMode: AgentReplayTargetMode;
  composerRef: RefObject<HTMLTextAreaElement>;
  setTranscriptPinnedToBottom: Dispatch<SetStateAction<boolean>>;
  toolDecisionBusyKey: string;
  setToolDecisionBusyKey: Dispatch<SetStateAction<string>>;
  setToolDecisionStatusByToken: Dispatch<
    SetStateAction<Record<string, "approved" | "rejected">>
  >;
};

type RunPromptOptions = {
  targetId?: string;
  enableTools?: boolean;
  enableRetrieval?: boolean;
  providerProfile?: AgentProviderProfile;
  thinkingMode?: AgentThinkingMode;
  historyTurns?: AgentTurn[];
  replaySource?: AgentTurn["replaySource"];
  displayPrompt?: string;
};

export function useAgentTurnLifecycle(input: TurnLifecycleInput) {
  async function runPrompt(nextPrompt: string, options?: RunPromptOptions) {
    const effectiveTargetId = options?.targetId || input.selectedTargetId;
    const effectiveTarget =
      input.agentTargets.find((target) => target.id === effectiveTargetId) ||
      input.selectedTarget;
    const effectiveEnableTools = options?.enableTools ?? input.enableTools;
    const effectiveEnableRetrieval =
      options?.enableRetrieval ?? input.enableRetrieval;
    const effectiveProviderProfile =
      options?.providerProfile ?? input.providerProfile;
    const effectiveThinkingMode = options?.thinkingMode ?? input.thinkingMode;
    const priorTurns = options?.historyTurns ?? input.turns;
    const turnId = `${Date.now()}`;

    input.setTranscriptPinnedToBottom(true);
    input.setPending(true);
    input.setError("");
    input.setInput("");
    input.setTurns([
      ...priorTurns,
      createPendingAgentTurn({
        id: turnId,
        target: effectiveTarget,
        prompt: nextPrompt,
        displayPrompt: options?.displayPrompt || nextPrompt,
        providerProfile: effectiveProviderProfile,
        thinkingMode: effectiveThinkingMode,
        replaySource: options?.replaySource,
      }),
    ]);

    try {
      await streamAgentPrompt({
        request: {
          targetId: effectiveTargetId,
          input: nextPrompt,
          messages: flattenTurns(priorTurns),
          systemPrompt: input.systemPrompt,
          enableTools: effectiveEnableTools,
          enableRetrieval: effectiveEnableRetrieval,
          contextWindow: input.contextWindow,
          providerProfile: effectiveProviderProfile,
          thinkingMode: effectiveThinkingMode,
        },
        requestFailed: input.text.requestFailed,
        onEvent: (event) => {
          input.setTurns((currentTurns) =>
            currentTurns.map((turn) =>
              turn.id === turnId
                ? applyAgentStreamEvent(
                    turn,
                    event,
                    input.text.noAssistantContent,
                  )
                : turn,
            ),
          );
        },
      });
    } catch (error) {
      input.setError(error instanceof Error ? error.message : "Unknown error");
      input.setInput(nextPrompt);
      input.setTurns((currentTurns) =>
        currentTurns.filter((turn) => turn.id !== turnId),
      );
    } finally {
      input.setPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.input.trim() || input.pending) return;
    await runPrompt(input.input.trim());
  }

  function handlePrepareReplayTurn(turn: AgentTurn) {
    if (input.replayTargetMode === "original") {
      input.setSelectedTargetId(turn.targetId);
      if (turn.providerProfile) input.setProviderProfile(turn.providerProfile);
      if (turn.thinkingMode) input.setThinkingMode(turn.thinkingMode);
      input.setEnableRetrieval(Boolean(turn.retrieval));
    }
    input.setInput(turn.prompt);
    input.setError("");
    requestAnimationFrame(() => {
      input.composerRef.current?.focus();
      input.composerRef.current?.scrollIntoView({ block: "nearest" });
    });
  }

  async function handleReplayTurn(
    turnIndex: number,
    turn: AgentTurn,
    options?: { includeHistory?: boolean },
  ) {
    if (input.pending) return;
    const useOriginalTarget = input.replayTargetMode === "original";
    const replayTargetId = useOriginalTarget
      ? turn.targetId
      : input.selectedTargetId;
    const replayTargetLabel = useOriginalTarget
      ? turn.targetLabel
      : input.selectedTarget.label;
    const replayProfile = useOriginalTarget
      ? turn.providerProfile
      : input.providerProfile;
    const replayThinkingMode = useOriginalTarget
      ? turn.thinkingMode
      : input.thinkingMode;
    const replayRetrieval = useOriginalTarget
      ? Boolean(turn.retrieval)
      : input.enableRetrieval;

    if (useOriginalTarget) {
      input.setSelectedTargetId(turn.targetId);
      if (turn.providerProfile) input.setProviderProfile(turn.providerProfile);
      if (turn.thinkingMode) input.setThinkingMode(turn.thinkingMode);
      input.setEnableRetrieval(Boolean(turn.retrieval));
    }

    const includeHistory = Boolean(options?.includeHistory);
    await runPrompt(turn.prompt, {
      targetId: replayTargetId,
      enableTools: input.enableTools,
      enableRetrieval: replayRetrieval,
      providerProfile: replayProfile,
      thinkingMode: replayThinkingMode,
      historyTurns: includeHistory ? input.turns.slice(0, turnIndex) : [],
      replaySource: {
        turnId: turn.id,
        targetId: turn.targetId,
        targetLabel: turn.targetLabel,
        resolvedModel: turn.resolvedModel,
        response: turn.response,
        includeHistory,
        targetMode: input.replayTargetMode,
      },
      displayPrompt: includeHistory
        ? input.locale.startsWith("en")
          ? `$ context replay ${replayTargetLabel}`
          : `$ 上下文回放 ${replayTargetLabel}`
        : input.locale.startsWith("en")
          ? `$ clean replay ${replayTargetLabel}`
          : `$ 干净回放 ${replayTargetLabel}`,
    });
  }

  async function handleResumeAgent(
    turnIndex: number,
    _turnId: string,
    turnTargetId: string,
    sourceToolRun: AgentToolRun,
    options?: { approvalContext?: boolean },
  ) {
    if (input.pending || input.toolDecisionBusyKey) return;
    const resumePrompt = [
      "Continue the current task from this point.",
      "",
      options?.approvalContext
        ? "A previously blocked tool step has now been approved and executed."
        : "Treat the following tool result as the replay point for the task.",
      `Tool: ${sourceToolRun.name}`,
      "Arguments:",
      JSON.stringify(sourceToolRun.input, null, 2),
      "",
      "Tool result:",
      sourceToolRun.output,
      "",
      "Use more tools if needed. Otherwise finish the task succinctly.",
    ].join("\n");
    const priorTurns = input.turns.slice(0, turnIndex + 1);
    const useOriginalTarget = input.replayTargetMode === "original";
    const resumeTargetId = useOriginalTarget
      ? turnTargetId
      : input.selectedTargetId;

    if (useOriginalTarget) input.setSelectedTargetId(turnTargetId);
    input.setPending(true);
    input.setError("");
    try {
      const data = await runAgentResumeRequest(
        {
          targetId: resumeTargetId,
          input: resumePrompt,
          messages: flattenTurns(priorTurns),
          systemPrompt: input.systemPrompt,
          enableTools: true,
          enableRetrieval: input.enableRetrieval,
          contextWindow: input.contextWindow,
          providerProfile: input.providerProfile,
          thinkingMode: input.thinkingMode,
        },
        input.text.resumeFailed,
      );
      input.setTurns((currentTurns) => [
        ...currentTurns,
        {
          id: `${Date.now()}-resume`,
          targetId: turnTargetId,
          prompt: resumePrompt,
          displayPrompt: `$ resume after approved tool::${sourceToolRun.name}`,
          response:
            data.content || data.warning || input.text.noAssistantContent,
          providerLabel: data.providerLabel,
          targetLabel: data.targetLabel,
          resolvedModel: data.resolvedModel,
          resolvedBaseUrl: data.resolvedBaseUrl,
          providerProfile: data.providerProfile,
          thinkingMode: data.thinkingMode,
          thinkingFallbackToStandard: data.thinkingFallbackToStandard,
          localFallbackUsed: data.localFallbackUsed,
          localFallbackTargetId: data.localFallbackTargetId,
          localFallbackTargetLabel: data.localFallbackTargetLabel,
          localFallbackReason: data.localFallbackReason,
          cacheHit: data.cacheHit,
          cacheMode: data.cacheMode,
          plannerSteps: data.plannerSteps,
          memorySummary: data.memorySummary,
          retrieval: data.retrieval,
          verification: data.verification,
          toolRuns: data.toolRuns,
          warning: data.warning,
        },
      ]);
    } catch (error) {
      input.setError(
        error instanceof Error ? error.message : input.text.resumeFailed,
      );
    } finally {
      input.setPending(false);
    }
  }

  function handleComposerKeyDown(
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!input.pending && input.input.trim()) {
        void runPrompt(input.input.trim());
      }
    }
  }

  async function handleToolDecision(
    turnId: string,
    turnTargetId: string,
    toolRunIndex: number,
    toolName: string,
    toolInput: Record<string, unknown>,
    confirmationToken: string,
    action: "approve" | "reject",
  ) {
    const busyKey = `${turnId}:${toolRunIndex}:${action}`;
    if (input.toolDecisionBusyKey) return;
    input.setToolDecisionBusyKey(busyKey);
    input.setError("");
    try {
      const data = await submitAgentToolDecision({
        targetId: turnTargetId,
        toolName,
        toolInput,
        confirmationToken,
        action,
        requestFailed: input.text.toolDecisionFailed,
      });
      const decisionStatus = readStringField(
        parseToolOutput(data.toolRun.output),
        "status",
      );
      input.setTurns((currentTurns) =>
        currentTurns.map((turn) =>
          turn.id !== turnId
            ? turn
            : { ...turn, toolRuns: [...turn.toolRuns, data.toolRun] },
        ),
      );
      if (action === "reject" || decisionStatus !== "confirmation_required") {
        input.setToolDecisionStatusByToken((current) => ({
          ...current,
          [confirmationToken]: action === "approve" ? "approved" : "rejected",
        }));
      }
    } catch (error) {
      input.setError(
        error instanceof Error ? error.message : input.text.toolDecisionFailed,
      );
    } finally {
      input.setToolDecisionBusyKey("");
    }
  }

  return {
    runPrompt,
    handleSubmit,
    handlePrepareReplayTurn,
    handleReplayTurn,
    handleResumeAgent,
    handleComposerKeyDown,
    handleToolDecision,
  };
}
