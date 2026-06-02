import { NextResponse } from "next/server";
import {
  createBenchmarkPromptSet,
  deleteBenchmarkPromptSet,
  readBenchmarkPromptSets,
  updateBenchmarkPromptSet,
} from "@/features/benchmark/application";

export const runtime = "nodejs";

type PromptSetBody = {
  id?: string;
  label?: string;
  description?: string;
  prompts?: string[];
};

export async function GET() {
  return NextResponse.json({
    promptSets: readBenchmarkPromptSets(),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PromptSetBody;
    const promptSet = createBenchmarkPromptSet(body);
    return NextResponse.json({ ok: true, promptSet });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create prompt set." },
      { status: error instanceof Error ? 400 : 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as PromptSetBody;
    const promptSet = updateBenchmarkPromptSet(body);
    return NextResponse.json({ ok: true, promptSet });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update prompt set.";
    return NextResponse.json(
      { error: message },
      { status: message === "Prompt set not found." ? 404 : 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim() || "";
  try {
    const deletedId = deleteBenchmarkPromptSet(id);
    return NextResponse.json({ ok: true, deletedId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete prompt set.";
    return NextResponse.json(
      { error: message },
      { status: message === "Prompt set not found." ? 404 : 400 },
    );
  }
}
