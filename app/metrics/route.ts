import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const now = Date.now() / 1000;
  const body = [
    "# HELP first_llm_studio_info Local First LLM Studio runtime info.",
    "# TYPE first_llm_studio_info gauge",
    `first_llm_studio_info{version="${process.env.npm_package_version ?? "dev"}"} 1`,
    "# HELP first_llm_studio_metrics_generated_seconds Unix timestamp of the metrics snapshot.",
    "# TYPE first_llm_studio_metrics_generated_seconds gauge",
    `first_llm_studio_metrics_generated_seconds ${now}`
  ].join("\n");

  return new Response(`${body}\n`, {
    headers: {
      "content-type": "text/plain; version=0.0.4; charset=utf-8"
    }
  });
}
