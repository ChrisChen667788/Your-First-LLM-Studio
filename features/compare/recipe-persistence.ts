"use client";

import { useCallback, useState } from "react";
import type {
  AgentCompareIntent,
  AgentCompareOutputShape,
  AgentProviderProfile,
  AgentStudioRecipe,
  AgentThinkingMode,
  AgentWorkbenchMode,
} from "@/lib/agent/types";

type RecipeApiPayload = {
  ok?: boolean;
  recipe?: AgentStudioRecipe;
  recipes?: AgentStudioRecipe[];
  error?: string;
};

export type CompareRecipeSaveInput = {
  workbenchMode: AgentWorkbenchMode;
  compareOutputShape: AgentCompareOutputShape;
  enableTools: boolean;
  enableRetrieval: boolean;
  targetIds: string[];
  input: string;
  systemPrompt: string;
  compareIntent: AgentCompareIntent;
  contextWindow: number;
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
};

function getRecipeErrorMessage(
  error: unknown,
  fallback: string,
) {
  return error instanceof Error ? error.message : fallback;
}

export function buildCompareRecipePayload({
  workbenchMode,
  compareOutputShape,
  enableTools,
  enableRetrieval,
  targetIds,
  input,
  systemPrompt,
  compareIntent,
  contextWindow,
  providerProfile,
  thinkingMode,
}: CompareRecipeSaveInput) {
  return {
    tags: [
      workbenchMode,
      compareOutputShape,
      enableTools ? "tools" : "no-tools",
      enableRetrieval ? "retrieval" : "no-retrieval",
    ],
    targetIds,
    input,
    systemPrompt,
    compareIntent,
    compareOutputShape,
    contextWindow,
    enableTools,
    enableRetrieval,
    providerProfile,
    thinkingMode,
  };
}

export function useCompareRecipePersistence({ locale }: { locale: string }) {
  const [recipes, setRecipes] = useState<AgentStudioRecipe[]>([]);
  const [recipesPending, setRecipesPending] = useState(false);
  const [recipesError, setRecipesError] = useState("");
  const [activeRecipeId, setActiveRecipeId] = useState("");
  const [recipeDraftLabel, setRecipeDraftLabel] = useState("");
  const [recipeDraftDescription, setRecipeDraftDescription] = useState("");

  const loadStudioRecipes = useCallback(async () => {
    setRecipesPending(true);
    setRecipesError("");
    try {
      const response = await fetch("/api/agent/recipes", { cache: "no-store" });
      const payload = (await response.json()) as RecipeApiPayload;
      if (!response.ok || !Array.isArray(payload.recipes)) {
        throw new Error(payload.error || "Failed to load studio recipes.");
      }
      setRecipes(payload.recipes);
    } catch (recipeLoadError) {
      setRecipesError(
        getRecipeErrorMessage(recipeLoadError, "Failed to load studio recipes."),
      );
    } finally {
      setRecipesPending(false);
    }
  }, []);

  const saveCurrentStudioRecipe = useCallback(
    async (input: CompareRecipeSaveInput) => {
      const label = recipeDraftLabel.trim();
      if (!label) {
        setRecipesError(
          locale.startsWith("en")
            ? "Recipe name is required."
            : "需要先填写配方名称。",
        );
        return;
      }
      setRecipesPending(true);
      setRecipesError("");
      try {
        const response = await fetch("/api/agent/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label,
            description: recipeDraftDescription.trim(),
            ...buildCompareRecipePayload(input),
          }),
        });
        const payload = (await response.json()) as RecipeApiPayload;
        if (!response.ok || !payload.recipe) {
          throw new Error(payload.error || "Failed to save recipe.");
        }
        await loadStudioRecipes();
        setActiveRecipeId(payload.recipe.id);
        setRecipeDraftLabel("");
        setRecipeDraftDescription("");
      } catch (recipeSaveError) {
        setRecipesError(
          getRecipeErrorMessage(recipeSaveError, "Failed to save recipe."),
        );
      } finally {
        setRecipesPending(false);
      }
    },
    [loadStudioRecipes, locale, recipeDraftDescription, recipeDraftLabel],
  );

  const deleteStudioRecipe = useCallback(
    async (recipeId: string) => {
      setRecipesPending(true);
      setRecipesError("");
      try {
        const response = await fetch(
          `/api/agent/recipes?id=${encodeURIComponent(recipeId)}`,
          { method: "DELETE" },
        );
        const payload = (await response.json()) as RecipeApiPayload;
        if (!response.ok) {
          throw new Error(payload.error || "Failed to delete recipe.");
        }
        await loadStudioRecipes();
        setActiveRecipeId((current) => (current === recipeId ? "" : current));
      } catch (recipeDeleteError) {
        setRecipesError(
          getRecipeErrorMessage(recipeDeleteError, "Failed to delete recipe."),
        );
      } finally {
        setRecipesPending(false);
      }
    },
    [loadStudioRecipes],
  );

  const exportStudioRecipesJson = useCallback(() => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      source: "first-llm-studio",
      recipes,
    };
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `first-llm-studio-recipes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [recipes]);

  const importStudioRecipesJson = useCallback(
    async (file: File) => {
      setRecipesPending(true);
      setRecipesError("");
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as unknown;
        const response = await fetch("/api/agent/recipes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed),
        });
        const payload = (await response.json()) as RecipeApiPayload;
        if (!response.ok) {
          throw new Error(payload.error || "Failed to import recipes.");
        }
        await loadStudioRecipes();
        const importedRecipeId = payload.recipes?.[0]?.id;
        if (importedRecipeId) {
          setActiveRecipeId(importedRecipeId);
        }
      } catch (recipeImportError) {
        setRecipesError(
          getRecipeErrorMessage(recipeImportError, "Failed to import recipes."),
        );
      } finally {
        setRecipesPending(false);
      }
    },
    [loadStudioRecipes],
  );

  return {
    recipes,
    recipesPending,
    recipesError,
    activeRecipeId,
    recipeDraftLabel,
    recipeDraftDescription,
    setRecipesError,
    setActiveRecipeId,
    setRecipeDraftLabel,
    setRecipeDraftDescription,
    loadStudioRecipes,
    saveCurrentStudioRecipe,
    deleteStudioRecipe,
    exportStudioRecipesJson,
    importStudioRecipesJson,
  };
}
