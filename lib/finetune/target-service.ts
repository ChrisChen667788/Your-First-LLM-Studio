import { listServerAgentTargets } from "@/lib/agent/server-targets";
import type { AgentFineTuneTargetOption } from "@/lib/agent/types";

export function resolveBaseModelRef(target: AgentFineTuneTargetOption) {
  if (target.sourcePath?.trim()) return target.sourcePath.trim();
  if (target.sourceRepoId?.trim()) return target.sourceRepoId.trim();
  if (target.modelDefault?.trim()) return target.modelDefault.trim();
  throw new Error(`No usable model reference found for ${target.label}.`);
}

export function buildFineTuneTargetSourceUrl(
  target: Pick<AgentFineTuneTargetOption, "sourceRepoId" | "sourceKind">,
) {
  const repoId = target.sourceRepoId?.trim();
  if (!repoId || !repoId.includes("/")) return undefined;
  if (
    target.sourceKind === "lm-studio" ||
    target.sourceKind === "huggingface-cache"
  ) {
    return `https://huggingface.co/${repoId}`;
  }
  return `https://huggingface.co/${repoId}`;
}

export function listFineTuneTargetOptions(): AgentFineTuneTargetOption[] {
  return listServerAgentTargets()
    .filter(
      (target) =>
        target.execution === "local" && target.sourceKind !== "adapter-runtime",
    )
    .map((target) => {
      const option = {
        id: target.id,
        label: target.label,
        providerLabel: target.providerLabel,
        modelDefault: target.modelDefault,
        parameterScale: target.parameterScale,
        quantizationLabel: target.quantizationLabel,
        recommendedContextWindow: target.recommendedContextWindow,
        sourceKind: target.sourceKind,
        sourceLabel: target.sourceLabel,
        sourcePath: target.sourcePath,
        sourceRepoId: target.sourceRepoId,
      } satisfies AgentFineTuneTargetOption;
      return {
        ...option,
        sourceUrl: buildFineTuneTargetSourceUrl(option),
      } satisfies AgentFineTuneTargetOption;
    });
}
