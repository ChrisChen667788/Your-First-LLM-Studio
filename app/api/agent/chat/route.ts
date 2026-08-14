import { handleAgentChatPost } from "@/features/agent/chat-application";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleAgentChatPost(request);
}
