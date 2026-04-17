import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { getLocalAgentDataDir, getLocalAgentDataPath } from "@/lib/agent/data-dir";
import { defaultStudioRecipes } from "@/lib/agent/studio-recipes";
import type { AgentStudioRecipe } from "@/lib/agent/types";

const DATA_DIR = getLocalAgentDataDir();
const RECIPE_FILE = getLocalAgentDataPath("studio-recipes.json");

function ensureDataDir() {
  mkdirSync(DATA_DIR, { recursive: true });
}

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

function writeRecipes(rows: AgentStudioRecipe[]) {
  ensureDataDir();
  writeFileSync(RECIPE_FILE, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
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

export function readStudioRecipes() {
  ensureDataDir();
  if (!existsSync(RECIPE_FILE)) {
    const rows = getInitialRecipes();
    writeRecipes(rows);
    return rows;
  }
  try {
    const payload = JSON.parse(readFileSync(RECIPE_FILE, "utf8")) as AgentStudioRecipe[];
    if (!Array.isArray(payload)) {
      const rows = getInitialRecipes();
      writeRecipes(rows);
      return rows;
    }
    const normalized = payload
      .map((entry) => normalizeRecipe(entry))
      .filter((entry) => entry.id && entry.label && entry.kind === "compare");
    const merged = mergeRecipes(normalized);
    if (JSON.stringify(merged) !== JSON.stringify(normalized)) {
      writeRecipes(merged);
    }
    return merged;
  } catch {
    const rows = getInitialRecipes();
    writeRecipes(rows);
    return rows;
  }
}

export function createStudioRecipe(input: Omit<AgentStudioRecipe, "id" | "source" | "createdAt" | "updatedAt"> & { id?: string }) {
  const rows = readStudioRecipes();
  const baseId = (input.id?.trim() || buildSlug(input.label)).slice(0, 64);
  let nextId = baseId;
  let counter = 2;
  while (rows.some((entry) => entry.id === nextId)) {
    nextId = `${baseId}-${counter}`.slice(0, 64);
    counter += 1;
  }
  const timestamp = new Date().toISOString();
  const record = normalizeRecipe({
    ...input,
    id: nextId,
    source: "user",
    createdAt: timestamp,
    updatedAt: timestamp
  });
  rows.push(record);
  writeRecipes(rows);
  return record;
}

export function deleteStudioRecipe(id: string) {
  const rows = readStudioRecipes();
  const recipe = rows.find((entry) => entry.id === id);
  if (!recipe) return { ok: false as const, reason: "not-found" };
  if (recipe.source === "builtin") return { ok: false as const, reason: "builtin" };
  const nextRows = rows.filter((entry) => entry.id !== id);
  writeRecipes(nextRows);
  return { ok: true as const };
}
