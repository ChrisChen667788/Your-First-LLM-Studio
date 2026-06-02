"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  AgentBenchmarkResponse,
  AgentFineTuneSourceSurface,
  AgentFineTuneSummary,
  AgentTarget,
} from "@/lib/agent/types";
import {
  buildFineTuneBenchmarkHandoffPlan,
  buildFineTuneCompareHandoffPlan,
} from "@/lib/finetune/handoff";
import { runCompareRequest } from "@/features/compare/actions";
import { postFineTuneAction } from "./actions";
import type { FineTuneMessageTone } from "./state";

type FineTuneStateSetter<T> = Dispatch<SetStateAction<T>>;

type FineTuneAdapterOrchestrationMessages = {
  runtimeAttachSuccess: string;
  runtimeDetachSuccess: string;
  handoffMissingContext: string;
  handoffBenchmarkSuccess: string;
  handoffCompareSuccess: string;
  proofLoopSuccess: string;
};

type FineTuneAdapterRuntimeAttachment = {
  summary: AgentFineTuneSummary;
  targetCatalog: AgentTarget[];
  attachedTargetLabel?: string;
};

type FineTuneAdapterOrchestrationOptions = {
  locale: string;
  surface: AgentFineTuneSourceSurface;
  summary: AgentFineTuneSummary | null;
  loadTargetCatalog: (force?: boolean) => Promise<AgentTarget[]>;
  setSummary: FineTuneStateSetter<AgentFineTuneSummary | null>;
  setActionPending: FineTuneStateSetter<Record<string, boolean>>;
  setMessage: FineTuneStateSetter<string>;
  setMessageTone: FineTuneStateSetter<FineTuneMessageTone>;
  messages: FineTuneAdapterOrchestrationMessages;
};

async function postBenchmarkHandoff(request: Record<string, unknown>) {
  const response = await fetch("/api/admin/benchmark", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const payload = (await response.json()) as AgentBenchmarkResponse & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error || "Benchmark handoff failed.");
  }
  return payload;
}

export function useFineTuneAdapterOrchestrationActions({
  locale,
  surface,
  summary,
  loadTargetCatalog,
  setSummary,
  setActionPending,
  setMessage,
  setMessageTone,
  messages,
}: FineTuneAdapterOrchestrationOptions) {
  const isEnglish = locale.startsWith("en");

  const ensureAdapterRuntimeAttached = useCallback(
    async (adapterId: string): Promise<FineTuneAdapterRuntimeAttachment> => {
      const payload = await postFineTuneAction({
        action: "attach-runtime",
        adapterId,
        sourceSurface: surface,
      });
      if (!payload.summary) {
        throw new Error(payload.error || "Adapter runtime attach failed.");
      }
      setSummary(payload.summary);
      const targetCatalog = await loadTargetCatalog(true);
      return {
        summary: payload.summary,
        targetCatalog,
        attachedTargetLabel: payload.attached?.target?.label,
      };
    },
    [loadTargetCatalog, setSummary, surface],
  );

  const attachAdapterRuntime = useCallback(
    async (adapterId: string) => {
      const actionKey = `adapter-attach:${adapterId}`;
      setActionPending((current) => ({ ...current, [actionKey]: true }));
      setMessage("");
      try {
        const result = await ensureAdapterRuntimeAttached(adapterId);
        setMessage(
          `${messages.runtimeAttachSuccess}${result.attachedTargetLabel ? ` ${isEnglish ? "Target:" : "目标："} ${result.attachedTargetLabel}` : ""}`,
        );
        setMessageTone("success");
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Adapter runtime attach failed.",
        );
        setMessageTone("error");
      } finally {
        setActionPending((current) => ({ ...current, [actionKey]: false }));
      }
    },
    [
      ensureAdapterRuntimeAttached,
      isEnglish,
      messages.runtimeAttachSuccess,
      setActionPending,
      setMessage,
      setMessageTone,
    ],
  );

  const detachAdapterRuntime = useCallback(
    async (adapterId: string) => {
      const actionKey = `adapter-detach:${adapterId}`;
      setActionPending((current) => ({ ...current, [actionKey]: true }));
      setMessage("");
      try {
        const payload = await postFineTuneAction({
          action: "detach-runtime",
          adapterId,
          sourceSurface: surface,
        });
        if (!payload.summary) {
          throw new Error(payload.error || "Adapter runtime detach failed.");
        }
        setSummary(payload.summary);
        await loadTargetCatalog(true);
        setMessage(
          `${messages.runtimeDetachSuccess}${payload.detached?.releasedRuntime ? ` ${isEnglish ? "Loaded model released." : "已同步释放当前加载模型。"} ` : ""}${
            payload.detached?.attachment?.label
              ? `${isEnglish ? "Target:" : "目标："} ${payload.detached.attachment.label}`
              : ""
          }`,
        );
        setMessageTone("success");
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Adapter runtime detach failed.",
        );
        setMessageTone("error");
      } finally {
        setActionPending((current) => ({ ...current, [actionKey]: false }));
      }
    },
    [
      isEnglish,
      loadTargetCatalog,
      messages.runtimeDetachSuccess,
      setActionPending,
      setMessage,
      setMessageTone,
      setSummary,
      surface,
    ],
  );

  const attachAdapterForHandoff = useCallback(
    async (adapterId: string) => {
      const attached = await ensureAdapterRuntimeAttached(adapterId).catch(
        (error) => {
          setMessage(
            error instanceof Error
              ? error.message
              : "Adapter runtime attach failed.",
          );
          setMessageTone("error");
          return null;
        },
      );
      return attached;
    },
    [ensureAdapterRuntimeAttached, setMessage, setMessageTone],
  );

  const runAdapterBenchmarkHandoff = useCallback(
    async (adapterId: string) => {
      if (!summary) return;
      const attached = await attachAdapterForHandoff(adapterId);
      if (!attached) return;
      const plan = buildFineTuneBenchmarkHandoffPlan({
        adapterId,
        summary: attached.summary,
        targetCatalog: attached.targetCatalog,
      });
      if (!plan) {
        setMessage(messages.handoffMissingContext);
        setMessageTone("error");
        return;
      }

      const actionKey = `adapter-benchmark:${adapterId}`;
      setActionPending((current) => ({ ...current, [actionKey]: true }));
      setMessage("");
      try {
        await postBenchmarkHandoff(plan.request);
        const peerSuffix = plan.referenceTargetLabel
          ? ` ${plan.referenceTargetLabel}`
          : "";
        setMessage(
          `${messages.handoffBenchmarkSuccess}${peerSuffix ? ` ${isEnglish ? "Reference:" : "参考目标："}${peerSuffix}` : ""}`,
        );
        setMessageTone("success");
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Benchmark handoff failed.",
        );
        setMessageTone("error");
      } finally {
        setActionPending((current) => ({ ...current, [actionKey]: false }));
      }
    },
    [
      attachAdapterForHandoff,
      isEnglish,
      messages.handoffBenchmarkSuccess,
      messages.handoffMissingContext,
      setActionPending,
      setMessage,
      setMessageTone,
      summary,
    ],
  );

  const runAdapterCompareHandoff = useCallback(
    async (adapterId: string) => {
      if (!summary) return;
      const attached = await attachAdapterForHandoff(adapterId);
      if (!attached) return;
      const plan = buildFineTuneCompareHandoffPlan({
        adapterId,
        summary: attached.summary,
        targetCatalog: attached.targetCatalog,
      });
      if (!plan) {
        setMessage(messages.handoffMissingContext);
        setMessageTone("error");
        return;
      }

      const actionKey = `adapter-compare:${adapterId}`;
      setActionPending((current) => ({ ...current, [actionKey]: true }));
      setMessage("");
      try {
        const payload = await runCompareRequest({
          ...plan.request,
          requestId: crypto.randomUUID(),
          sourceSurface: "fine-tune-handoff",
        });
        setMessage(
          `${messages.handoffCompareSuccess} ${payload.results.filter((lane) => lane.ok).length}/${payload.results.length} ${isEnglish ? "lanes returned output." : "个 lane 返回了结果。"}`,
        );
        setMessageTone("success");
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Compare handoff failed.",
        );
        setMessageTone("error");
      } finally {
        setActionPending((current) => ({ ...current, [actionKey]: false }));
      }
    },
    [
      attachAdapterForHandoff,
      isEnglish,
      messages.handoffCompareSuccess,
      messages.handoffMissingContext,
      setActionPending,
      setMessage,
      setMessageTone,
      summary,
    ],
  );

  const runAdapterProofLoop = useCallback(
    async (adapterId: string) => {
      if (!summary) return;
      const actionKey = `adapter-proof:${adapterId}`;
      setActionPending((current) => ({ ...current, [actionKey]: true }));
      setMessage("");
      try {
        const attached = await ensureAdapterRuntimeAttached(adapterId);
        const comparePlan = buildFineTuneCompareHandoffPlan({
          adapterId,
          summary: attached.summary,
          targetCatalog: attached.targetCatalog,
        });
        const benchmarkPlan = buildFineTuneBenchmarkHandoffPlan({
          adapterId,
          summary: attached.summary,
          targetCatalog: attached.targetCatalog,
        });
        if (!comparePlan || !benchmarkPlan) {
          throw new Error(messages.handoffMissingContext);
        }

        await runCompareRequest({
          ...comparePlan.request,
          requestId: crypto.randomUUID(),
          sourceSurface: "fine-tune-handoff",
        });
        await postBenchmarkHandoff(benchmarkPlan.request);

        setMessage(messages.proofLoopSuccess);
        setMessageTone("success");
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Adapter proof loop failed.",
        );
        setMessageTone("error");
      } finally {
        setActionPending((current) => ({ ...current, [actionKey]: false }));
      }
    },
    [
      ensureAdapterRuntimeAttached,
      messages.handoffMissingContext,
      messages.proofLoopSuccess,
      setActionPending,
      setMessage,
      setMessageTone,
      summary,
    ],
  );

  return {
    ensureAdapterRuntimeAttached,
    attachAdapterRuntime,
    detachAdapterRuntime,
    runAdapterBenchmarkHandoff,
    runAdapterCompareHandoff,
    runAdapterProofLoop,
  };
}
