import { NextResponse } from "next/server";
import { listPublicOpenAIModels } from "@/features/providers/openai-compatible-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    object: "list",
    data: listPublicOpenAIModels(),
  });
}
