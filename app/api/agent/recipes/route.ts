import { NextResponse } from "next/server";
import {
  createStudioRecipe,
  deleteStudioRecipe,
  importStudioRecipes,
  readStudioRecipes
} from "@/lib/agent/studio-recipe-store";
import type { AgentStudioRecipe } from "@/lib/agent/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RecipeBody = Partial<AgentStudioRecipe> & {
  id?: string;
};

type RecipeImportEnvelope = {
  recipes?: RecipeBody[];
};

type ValidatedRecipePayload = {
  id?: string;
  label: string;
  description: string;
  tags: string[];
  targetIds: string[];
  input: string;
  systemPrompt: string;
  kind: "compare";
  compareIntent: AgentStudioRecipe["compareIntent"];
  compareOutputShape: AgentStudioRecipe["compareOutputShape"];
  contextWindow: number;
  enableTools: boolean;
  enableRetrieval: boolean;
  providerProfile: AgentStudioRecipe["providerProfile"];
  thinkingMode: AgentStudioRecipe["thinkingMode"];
};

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => normalizeText(entry)).filter(Boolean)
    : [];
}

function validateRecipePayload(body: RecipeBody): { error: string } | ValidatedRecipePayload {
  const label = normalizeText(body.label);
  if (!label) return { error: "Recipe label is required." };
  const description = normalizeText(body.description);
  const input = typeof body.input === "string" ? body.input : "";
  const systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt : "";
  const compareIntent = body.compareIntent;
  const compareOutputShape = body.compareOutputShape;
  const providerProfile = body.providerProfile;
  const thinkingMode = body.thinkingMode;
  if (
    compareIntent !== "model-vs-model" &&
    compareIntent !== "preset-vs-preset" &&
    compareIntent !== "template-vs-template" &&
    compareIntent !== "before-vs-after"
  ) {
    return { error: "A valid compare intent is required." };
  }
  if (compareOutputShape !== "freeform" && compareOutputShape !== "bullet-list" && compareOutputShape !== "strict-json") {
    return { error: "A valid compare output shape is required." };
  }
  if (providerProfile !== "speed" && providerProfile !== "balanced" && providerProfile !== "tool-first") {
    return { error: "A valid provider profile is required." };
  }
  if (thinkingMode !== "standard" && thinkingMode !== "thinking") {
    return { error: "A valid thinking mode is required." };
  }
  const contextWindow = Number(body.contextWindow || 0);
  if (!Number.isFinite(contextWindow) || contextWindow <= 0) {
    return { error: "A valid context window is required." };
  }

  return {
    id: normalizeText(body.id) || undefined,
    label,
    description,
    tags: normalizeStringArray(body.tags),
    targetIds: normalizeStringArray(body.targetIds),
    input,
    systemPrompt,
    kind: "compare" as const,
    compareIntent,
    compareOutputShape,
    contextWindow,
    enableTools: normalizeBoolean(body.enableTools, false),
    enableRetrieval: normalizeBoolean(body.enableRetrieval, false),
    providerProfile,
    thinkingMode
  };
}

function extractImportRows(body: unknown) {
  if (Array.isArray(body)) return body as RecipeBody[];
  if (body && typeof body === "object" && Array.isArray((body as RecipeImportEnvelope).recipes)) {
    return (body as RecipeImportEnvelope).recipes || [];
  }
  return [];
}

export async function GET() {
  return NextResponse.json({ ok: true, recipes: readStudioRecipes() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RecipeBody;
    const validated = validateRecipePayload(body);
    if ("error" in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const recipe = createStudioRecipe(validated);
    return NextResponse.json({ ok: true, recipe });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create recipe." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const rows = extractImportRows(body);
    if (!rows.length) {
      return NextResponse.json({ error: "Recipe import requires a recipes array." }, { status: 400 });
    }

    const validatedRows: ValidatedRecipePayload[] = [];
    for (const row of rows) {
      const validated = validateRecipePayload(row);
      if ("error" in validated) {
        return NextResponse.json(
          { error: `${validated.error} (${normalizeText(row.label) || normalizeText(row.id) || "unknown recipe"})` },
          { status: 400 }
        );
      }
      validatedRows.push(validated);
    }

    const result = importStudioRecipes(validatedRows);
    return NextResponse.json({
      ok: true,
      importedCount: result.importedCount,
      replacedCount: result.replacedCount,
      skippedCount: result.skippedCount,
      recipes: result.imported
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import recipes." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = normalizeText(searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "Recipe id is required." }, { status: 400 });
  }
  const deleted = deleteStudioRecipe(id);
  if (!deleted.ok) {
    return NextResponse.json(
      {
        error:
          deleted.reason === "builtin" ? "Built-in recipes cannot be deleted." : "Recipe not found."
      },
      { status: deleted.reason === "builtin" ? 400 : 404 }
    );
  }
  return NextResponse.json({ ok: true, deletedId: id });
}
