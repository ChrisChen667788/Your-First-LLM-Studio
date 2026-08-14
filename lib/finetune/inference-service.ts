import { runProviderCompletion } from "@/features/providers/provider-port";
import { getServerAgentTarget } from "@/lib/agent/server-targets";
import type { AgentChatResponse } from "@/lib/agent/types";
import { resolveFineTuneAdapter } from "./operation-shared";

export type FineTuneInferenceOptions = {
  maxNewTokens?: number;
  temperature?: number;
  topP?: number;
  systemPrompt?: string;
};

export async function mapFineTuneInferenceWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  runner: (value: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await runner(values[index], index);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.max(1, Math.min(concurrency, values.length || 1)) },
      worker,
    ),
  );
  return results;
}

export function resolveAttachedAdapterTargetId(adapterId: string) {
  const { adapter } = resolveFineTuneAdapter(adapterId);
  if (!adapter.attachedTargetId) {
    throw new Error(
      "Adapter runtime is not attached. Attach the selected or best checkpoint before chat or evaluation.",
    );
  }
  if (!getServerAgentTarget(adapter.attachedTargetId)) {
    throw new Error(
      `Attached adapter target ${adapter.attachedTargetId} is not present in the runtime catalog. Re-attach the adapter and retry.`,
    );
  }
  return { adapter, targetId: adapter.attachedTargetId };
}

export async function runFineTuneAdapterInference(input: {
  adapterId: string;
  prompt: string;
  options?: FineTuneInferenceOptions;
}): Promise<AgentChatResponse> {
  const { targetId } = resolveAttachedAdapterTargetId(input.adapterId);
  return runProviderCompletion({
    targetId,
    input: input.prompt,
    systemPrompt:
      input.options?.systemPrompt ||
      "You are an evaluation runtime for a mounted LoRA adapter. Return the answer only.",
    providerProfile: "balanced",
    thinkingMode: "standard",
    maxTokens: input.options?.maxNewTokens,
    temperature: input.options?.temperature,
    topP: input.options?.topP,
    operation: "finetune-adapter-inference",
  });
}

export async function runFineTuneTeacherInference(input: {
  teacherTargetId: string;
  prompt: string;
  options?: FineTuneInferenceOptions;
}): Promise<AgentChatResponse> {
  if (!getServerAgentTarget(input.teacherTargetId)) {
    throw new Error(`Teacher target not found: ${input.teacherTargetId}`);
  }
  return runProviderCompletion({
    targetId: input.teacherTargetId,
    input: input.prompt,
    systemPrompt:
      input.options?.systemPrompt ||
      "You are a teacher model producing high-quality instruction-tuning answers. Return the answer only and do not expose hidden chain-of-thought.",
    providerProfile: "balanced",
    thinkingMode: "standard",
    maxTokens: input.options?.maxNewTokens,
    temperature: input.options?.temperature,
    topP: input.options?.topP,
    operation: "finetune-teacher-inference",
  });
}
