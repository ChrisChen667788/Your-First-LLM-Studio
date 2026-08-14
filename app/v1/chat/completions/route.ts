import { handleOpenAICompatibleChatCompletion } from "@/features/providers/openai-compatible-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleOpenAICompatibleChatCompletion(request);
}
