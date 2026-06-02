"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  AgentBenchmarkResponse,
  AgentCompareIntent,
  AgentCompareLaneProgress,
  AgentCompareOutputShape,
  AgentCompareResponse,
  AgentCompareSourceSurface,
  AgentMessage,
  AgentProviderProfile,
  AgentStudioRecipe,
  AgentTarget,
  AgentThinkingMode,
  AgentWorkbenchMode,
} from "@/lib/agent/types";
import { clampContextWindowForTarget } from "@/lib/agent/metrics";
import {
  runCompareRequest,
  sendCompareBenchmarkHandoff,
} from "./actions";

type CompareRecipeStateSetter<T> = Dispatch<SetStateAction<T>>;

type CompareRecipeResolution =
  | { error: string }
  | {
      recipe: AgentStudioRecipe;
      validRecipeTargetIds: string[];
      nextSelectedTargetId: string;
    };

type CompareRecipeOrchestrationOptions = {
  locale: string;
  sourceSurface: AgentCompareSourceSurface;
  recipes: AgentStudioRecipe[];
  agentTargets: AgentTarget[];
  selectedTargetId: string;
  historyMessages: AgentMessage[];
  setRecipesError: CompareRecipeStateSetter<string>;
  setActiveRecipeId: CompareRecipeStateSetter<string>;
  setRecipeDraftLabel: CompareRecipeStateSetter<string>;
  setRecipeDraftDescription: CompareRecipeStateSetter<string>;
  setSelectedTargetId: CompareRecipeStateSetter<string>;
  setCompareTargetIds: CompareRecipeStateSetter<string[]>;
  setInput: CompareRecipeStateSetter<string>;
  setSystemPrompt: CompareRecipeStateSetter<string>;
  setCompareIntent: CompareRecipeStateSetter<AgentCompareIntent>;
  setCompareOutputShape: CompareRecipeStateSetter<AgentCompareOutputShape>;
  setContextWindow: CompareRecipeStateSetter<number>;
  setEnableTools: CompareRecipeStateSetter<boolean>;
  setEnableRetrieval: CompareRecipeStateSetter<boolean>;
  setProviderProfile: CompareRecipeStateSetter<AgentProviderProfile>;
  setThinkingMode: CompareRecipeStateSetter<AgentThinkingMode>;
  setWorkbenchMode: CompareRecipeStateSetter<AgentWorkbenchMode>;
  setComparePending: CompareRecipeStateSetter<boolean>;
  setCompareError: CompareRecipeStateSetter<string>;
  setCompareResult: CompareRecipeStateSetter<AgentCompareResponse | null>;
  setCompareBaseTargetId: CompareRecipeStateSetter<string>;
  setCompareRequestId: CompareRecipeStateSetter<string>;
  setCompareProgressByTargetId: CompareRecipeStateSetter<
    Record<string, AgentCompareLaneProgress>
  >;
  setBenchmarkPending: CompareRecipeStateSetter<boolean>;
  setBenchmarkError: CompareRecipeStateSetter<string>;
  setBenchmarkResult: CompareRecipeStateSetter<AgentBenchmarkResponse | null>;
};

export function resolveCompareRecipeState({
  locale,
  recipes,
  agentTargets,
  selectedTargetId,
  recipeId,
}: {
  locale: string;
  recipes: AgentStudioRecipe[];
  agentTargets: AgentTarget[];
  selectedTargetId: string;
  recipeId: string;
}): CompareRecipeResolution {
  const recipe = recipes.find((entry) => entry.id === recipeId);
  if (!recipe) {
    return {
      error: locale.startsWith("en")
        ? "Recipe not found."
        : "没有找到这个配方。",
    };
  }
  const validRecipeTargetIds = Array.from(
    new Set(
      recipe.targetIds.filter((targetId) =>
        agentTargets.some((target) => target.id === targetId),
      ),
    ),
  );
  const nextSelectedTargetId =
    validRecipeTargetIds[0] ||
    (agentTargets.some((target) => target.id === selectedTargetId)
      ? selectedTargetId
      : agentTargets[0]?.id);
  if (!nextSelectedTargetId) {
    return {
      error: locale.startsWith("en")
        ? "No valid targets are available for this recipe."
        : "这个配方当前没有可用目标。",
    };
  }
  return {
    recipe,
    validRecipeTargetIds: validRecipeTargetIds.length
      ? validRecipeTargetIds
      : [nextSelectedTargetId],
    nextSelectedTargetId,
  };
}

async function buildRecipeBenchmarkPrompt(recipe: AgentStudioRecipe) {
  const compareShare = await import("@/lib/agent/compare-share");
  return compareShare.buildCompareBenchmarkPrompt({
    input: recipe.input,
    systemPrompt: recipe.systemPrompt,
    compareOutputShape: recipe.compareOutputShape,
    compareBenchmarkUseOutputContract: true,
  });
}

function buildRecipeBenchmarkRunNote(
  recipe: AgentStudioRecipe,
  validRecipeTargetIds: string[],
) {
  return [
    `Recipe handoff: ${recipe.label}`,
    recipe.description ? `Description: ${recipe.description}` : "",
    `Targets: ${validRecipeTargetIds.join(", ")}`,
    `Intent: ${recipe.compareIntent}`,
    `Output: ${recipe.compareOutputShape}`,
    `Profile: ${recipe.providerProfile}`,
    `Thinking: ${recipe.thinkingMode}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function useCompareRecipeOrchestration({
  locale,
  sourceSurface,
  recipes,
  agentTargets,
  selectedTargetId,
  historyMessages,
  setRecipesError,
  setActiveRecipeId,
  setRecipeDraftLabel,
  setRecipeDraftDescription,
  setSelectedTargetId,
  setCompareTargetIds,
  setInput,
  setSystemPrompt,
  setCompareIntent,
  setCompareOutputShape,
  setContextWindow,
  setEnableTools,
  setEnableRetrieval,
  setProviderProfile,
  setThinkingMode,
  setWorkbenchMode,
  setComparePending,
  setCompareError,
  setCompareResult,
  setCompareBaseTargetId,
  setCompareRequestId,
  setCompareProgressByTargetId,
  setBenchmarkPending,
  setBenchmarkError,
  setBenchmarkResult,
}: CompareRecipeOrchestrationOptions) {
  const resolveStudioRecipeState = useCallback(
    (recipeId: string) =>
      resolveCompareRecipeState({
        locale,
        recipes,
        agentTargets,
        selectedTargetId,
        recipeId,
      }),
    [agentTargets, locale, recipes, selectedTargetId],
  );

  const applyStudioRecipeState = useCallback(
    (
      recipe: AgentStudioRecipe,
      nextSelectedTargetId: string,
      validRecipeTargetIds: string[],
    ) => {
      setSelectedTargetId(nextSelectedTargetId);
      setCompareTargetIds(validRecipeTargetIds);
      setInput(recipe.input);
      setSystemPrompt(recipe.systemPrompt);
      setCompareIntent(recipe.compareIntent);
      setCompareOutputShape(recipe.compareOutputShape);
      setContextWindow(
        clampContextWindowForTarget(
          nextSelectedTargetId,
          recipe.contextWindow,
          {
            enableTools: recipe.enableTools,
            enableRetrieval: recipe.enableRetrieval,
          },
        ),
      );
      setEnableTools(recipe.enableTools);
      setEnableRetrieval(recipe.enableRetrieval);
      setProviderProfile(recipe.providerProfile);
      setThinkingMode(recipe.thinkingMode);
      setWorkbenchMode("compare");
      setActiveRecipeId(recipe.id);
      setRecipeDraftLabel(recipe.label);
      setRecipeDraftDescription(recipe.description);
      setRecipesError("");
    },
    [
      setActiveRecipeId,
      setCompareIntent,
      setCompareOutputShape,
      setCompareTargetIds,
      setContextWindow,
      setEnableRetrieval,
      setEnableTools,
      setInput,
      setProviderProfile,
      setRecipeDraftDescription,
      setRecipeDraftLabel,
      setRecipesError,
      setSelectedTargetId,
      setSystemPrompt,
      setThinkingMode,
      setWorkbenchMode,
    ],
  );

  const applyStudioRecipe = useCallback(
    (recipeId: string) => {
      const resolved = resolveStudioRecipeState(recipeId);
      if ("error" in resolved) {
        setRecipesError(resolved.error);
        return;
      }
      applyStudioRecipeState(
        resolved.recipe,
        resolved.nextSelectedTargetId,
        resolved.validRecipeTargetIds,
      );
    },
    [applyStudioRecipeState, resolveStudioRecipeState, setRecipesError],
  );

  const runStudioRecipeCompare = useCallback(
    async (recipeId: string) => {
      const resolved = resolveStudioRecipeState(recipeId);
      if ("error" in resolved) {
        setRecipesError(resolved.error);
        return;
      }
      const { recipe, validRecipeTargetIds, nextSelectedTargetId } = resolved;
      applyStudioRecipeState(
        recipe,
        nextSelectedTargetId,
        validRecipeTargetIds,
      );

      const requestId = crypto.randomUUID();
      setComparePending(true);
      setCompareError("");
      setBenchmarkError("");
      setBenchmarkResult(null);
      setCompareRequestId(requestId);
      setCompareProgressByTargetId({});
      try {
        const payload = await runCompareRequest({
          requestId,
          sourceSurface,
          targetIds: validRecipeTargetIds,
          input: recipe.input,
          messages: historyMessages,
          systemPrompt: recipe.systemPrompt,
          compareIntent: recipe.compareIntent,
          compareOutputShape: recipe.compareOutputShape,
          enableTools: recipe.enableTools,
          enableRetrieval: recipe.enableRetrieval,
          contextWindow: recipe.contextWindow,
          providerProfile: recipe.providerProfile,
          thinkingMode: recipe.thinkingMode,
        });
        setCompareResult(payload);
        setCompareRequestId(payload.requestId || requestId);
        setCompareBaseTargetId(payload.results[0]?.targetId || "");
      } catch (recipeCompareError) {
        setCompareError(
          recipeCompareError instanceof Error
            ? recipeCompareError.message
            : "Recipe compare run failed.",
        );
      } finally {
        setComparePending(false);
      }
    },
    [
      applyStudioRecipeState,
      historyMessages,
      resolveStudioRecipeState,
      setBenchmarkError,
      setBenchmarkResult,
      setCompareBaseTargetId,
      setCompareError,
      setComparePending,
      setCompareProgressByTargetId,
      setCompareRequestId,
      setCompareResult,
      setRecipesError,
      sourceSurface,
    ],
  );

  const runStudioRecipeBenchmark = useCallback(
    async (recipeId: string) => {
      const resolved = resolveStudioRecipeState(recipeId);
      if ("error" in resolved) {
        setRecipesError(resolved.error);
        return;
      }
      const { recipe, validRecipeTargetIds, nextSelectedTargetId } = resolved;
      applyStudioRecipeState(
        recipe,
        nextSelectedTargetId,
        validRecipeTargetIds,
      );

      setBenchmarkPending(true);
      setBenchmarkError("");
      setBenchmarkResult(null);
      try {
        const prompt = await buildRecipeBenchmarkPrompt(recipe);
        const payload = await sendCompareBenchmarkHandoff({
          targetIds: validRecipeTargetIds,
          benchmarkMode: "prompt",
          prompt,
          runNote: buildRecipeBenchmarkRunNote(recipe, validRecipeTargetIds),
          runs: 1,
          contextWindow: recipe.contextWindow,
          providerProfile: recipe.providerProfile,
          thinkingMode: recipe.thinkingMode,
        });
        setBenchmarkResult(payload);
      } catch (recipeBenchmarkError) {
        setBenchmarkError(
          recipeBenchmarkError instanceof Error
            ? recipeBenchmarkError.message
            : "Recipe benchmark handoff failed.",
        );
      } finally {
        setBenchmarkPending(false);
      }
    },
    [
      applyStudioRecipeState,
      resolveStudioRecipeState,
      setBenchmarkError,
      setBenchmarkPending,
      setBenchmarkResult,
      setRecipesError,
    ],
  );

  return {
    applyStudioRecipe,
    runStudioRecipeCompare,
    runStudioRecipeBenchmark,
  };
}
