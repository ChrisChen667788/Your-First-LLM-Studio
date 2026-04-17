import { NextResponse } from "next/server";
import { createStudioRecipe, deleteStudioRecipe, readStudioRecipes } from "@/lib/agent/studio-recipe-store";
import type { AgentStudioRecipe } from "@/lib/agent/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RecipeBody = Partial<AgentStudioRecipe> & {
  id?: string;
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

function validateRecipePayload(body: RecipeBody) {
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
    const recipe = createStudioRecipe({ ...validated, id: body.id });
    return NextResponse.json({ ok: true, recipe });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create recipe." },
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
