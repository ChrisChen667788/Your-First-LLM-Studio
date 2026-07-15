import { exportAgentCheckHistory } from "@/features/agent/check-history-application";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const result = exportAgentCheckHistory({
    targetId: searchParams.get("targetId") || undefined,
    format: searchParams.get("format") || undefined,
  });
  return new Response(result.body, {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
