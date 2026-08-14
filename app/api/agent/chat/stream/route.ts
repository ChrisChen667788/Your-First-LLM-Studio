import { handleAgentChatStreamPost } from "@/features/agent/chat-stream-application";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleAgentChatStreamPost(request);
}
