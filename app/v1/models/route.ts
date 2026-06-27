import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const models = [
    process.env.OPENAI_CODEX_MODEL ?? "gpt-5.3-codex",
    process.env.OPENAI_GPT55_MODEL ?? "gpt-5.5",
    process.env.DEEPSEEK_MODEL ?? "deepseek-reasoner"
  ];

  return NextResponse.json({
    object: "list",
    data: Array.from(new Set(models)).map((id) => ({
      id,
      object: "model",
      created: 0,
      owned_by: id.includes("deepseek") ? "deepseek" : "local-agent-lab"
    }))
  });
}
