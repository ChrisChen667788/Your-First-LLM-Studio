import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RegistryEntry = {
  id: string;
  kind: "local" | "remote";
  status: "available" | "unconfigured";
  endpoint?: string;
  model?: string;
};

function deploymentSnapshot(): RegistryEntry[] {
  return [
    {
      id: "openai-compatible",
      kind: "remote",
      status: process.env.OPENAI_API_KEY ? "available" : "unconfigured",
      endpoint: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      model: process.env.OPENAI_CODEX_MODEL ?? "gpt-5.3-codex"
    },
    {
      id: "deepseek",
      kind: "remote",
      status: process.env.DEEPSEEK_API_KEY ? "available" : "unconfigured",
      endpoint: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-reasoner"
    }
  ];
}

export async function GET() {
  const targets = deploymentSnapshot();
  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    revision: "local-dev",
    targets,
    audit: []
  });
}

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "deployment_registry_read_only",
      message: "Local dev registry is read-only until the production registry adapter is configured."
    },
    { status: 409 }
  );
}
