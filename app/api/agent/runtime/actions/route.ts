import { handleAgentRuntimeActionPost } from "@/features/agent/runtime-action-application";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleAgentRuntimeActionPost(request);
}
