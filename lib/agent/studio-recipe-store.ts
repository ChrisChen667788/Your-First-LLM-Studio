import { getLocalAgentDataPath } from "@/lib/agent/data-dir";
import { defaultStudioRecipes } from "@/lib/agent/studio-recipes";
import type { AgentStudioRecipe } from "@/lib/agent/types";
import {
  readJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";

const RECIPE_FILE = getLocalAgentDataPath("studio-recipes.json");

type MutableStudioRecipeInput = Omit<AgentStudioRecipe, "id" | "source" | "createdAt" | "updatedAt"> & {
  id?: string;
};

export type StudioRecipeImportResult = {
  imported: AgentStudioRecipe[];
  importedCount: number;
  replacedCount: number;
  skippedCount: number;
};

function buildSlug(label: string) {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 56) || "recipe"
  );
}

function normalizeRecipe(input: AgentStudioRecipe): AgentStudioRecipe {
  const createdAt = input.createdAt || new Date().toISOString();
  const updatedAt = input.updatedAt || createdAt;
  return {
    ...input,
    id: input.id.trim(),
    label: input.label.trim(),
    description: input.description.trim(),
    tags: [...new Set((input.tags || []).map((tag) => String(tag || "").trim()).filter(Boolean))],
    targetIds: [...new Set((input.targetIds || []).map((entry) => String(entry || "").trim()).filter(Boolean))],
    input: input.input || "",
    systemPrompt: input.systemPrompt || "",
    createdAt,
    updatedAt
  };
}

function getInitialRecipes() {
  return defaultStudioRecipes.map((entry) => normalizeRecipe({ ...entry }));
}

function mergeRecipes(userRecipes: AgentStudioRecipe[]) {
  const merged = new Map<string, AgentStudioRecipe>();
  for (const entry of getInitialRecipes()) {
    merged.set(entry.id, normalizeRecipe(entry));
  }
  for (const entry of userRecipes.map((value) => normalizeRecipe(value))) {
    merged.set(entry.id, entry);
  }
  return [...merged.values()].sort((a, b) => {
    if (a.source !== b.source) {
      return a.source === "builtin" ? -1 : 1;
    }
    return a.label.localeCompare(b.label, "en");
  });
}

function buildUniqueRecipeId(existingRows: AgentStudioRecipe[], label: string, preferredId?: string | null) {
  const baseId = (preferredId?.trim() || buildSlug(label)).slice(0, 64);
  let nextId = baseId;
  let counter = 2;
  while (existingRows.some((entry) => entry.id === nextId)) {
    nextId = `${baseId}-${counter}`.slice(0, 64);
    counter += 1;
  }
  return nextId;
}

function updateRecipes(
  mutate: (rows: AgentStudioRecipe[]) => AgentStudioRecipe[],
) {
  return updateJsonFileDurably(
    RECIPE_FILE,
    getInitialRecipes,
    (current) => mutate(mergeRecipes(current)),
    (value): value is AgentStudioRecipe[] => Array.isArray(value),
  );
}

export function readStudioRecipes() {
  const payload = readJsonFileDurably(
    RECIPE_FILE,
    getInitialRecipes,
    (value): value is AgentStudioRecipe[] => Array.isArray(value),
  );
  const normalized = payload
    .map((entry) => normalizeRecipe(entry))
    .filter((entry) => entry.id && entry.label && entry.kind === "compare");
  const merged = mergeRecipes(normalized);
  if (JSON.stringify(merged) !== JSON.stringify(normalized)) {
    updateJsonFileDurably(
      RECIPE_FILE,
      getInitialRecipes,
      () => merged,
      (value): value is AgentStudioRecipe[] => Array.isArray(value),
    );
  }
  return merged;
}

export function createStudioRecipe(input: MutableStudioRecipeInput) {
  const outcome: { record?: AgentStudioRecipe } = {};
  updateRecipes((rows) => {
    const nextId = buildUniqueRecipeId(rows, input.label, input.id);
    const timestamp = new Date().toISOString();
    outcome.record = normalizeRecipe({
      ...input,
      id: nextId,
      source: "user",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return [...rows, outcome.record];
  });
  return outcome.record!;
}

export function importStudioRecipes(inputs: MutableStudioRecipeInput[]): StudioRecipeImportResult {
  const imported: AgentStudioRecipe[] = [];
  let replacedCount = 0;
  let skippedCount = 0;
  updateRecipes((current) => {
    const rows = [...current];
    for (const input of inputs) {
      const builtinRecipe = input.id
        ? rows.find((entry) => entry.id === input.id && entry.source === "builtin") || null
        : null;
      if (builtinRecipe) {
        skippedCount += 1;
        continue;
      }
      const existingUserRecipe = input.id
        ? rows.find((entry) => entry.id === input.id && entry.source === "user") || null
        : null;
      if (existingUserRecipe) {
        const nextRecord = normalizeRecipe({
          ...existingUserRecipe,
          ...input,
          id: existingUserRecipe.id,
          source: "user",
          createdAt: existingUserRecipe.createdAt,
          updatedAt: new Date().toISOString(),
        });
        rows[rows.findIndex((entry) => entry.id === existingUserRecipe.id)] = nextRecord;
        imported.push(nextRecord);
        replacedCount += 1;
        continue;
      }
      const nextId = buildUniqueRecipeId(rows, input.label, input.id);
      const timestamp = new Date().toISOString();
      const record = normalizeRecipe({
        ...input,
        id: nextId,
        source: "user",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      rows.push(record);
      imported.push(record);
    }
    return rows;
  });
  return {
    imported,
    importedCount: imported.length,
    replacedCount,
    skippedCount
  };
}

export function deleteStudioRecipe(id: string) {
  const outcome: { result?: { ok: true } | { ok: false; reason: "not-found" | "builtin" } } = {};
  updateRecipes((rows) => {
    const recipe = rows.find((entry) => entry.id === id);
    if (!recipe) {
      outcome.result = { ok: false, reason: "not-found" };
      return rows;
    }
    if (recipe.source === "builtin") {
      outcome.result = { ok: false, reason: "builtin" };
      return rows;
    }
    outcome.result = { ok: true };
    return rows.filter((entry) => entry.id !== id);
  });
  return outcome.result!;
}
