import { NextResponse } from "next/server";
import {
  MCP_FILESYSTEM_ACCEPTANCE_ROOT,
  readMcpServerRegistry,
  registerPinnedFilesystemMcpServer,
  setMcpServerEnabled,
} from "@/features/extensions/mcp-server-registry";
import { runMcpFilesystemAcceptance } from "@/features/extensions/mcp-filesystem-acceptance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readMcpServerRegistry());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: "register-filesystem" | "enable" | "disable" | "probe";
      root?: string;
      serverId?: string;
    };
    const result =
      body.action === "enable" || body.action === "disable"
        ? setMcpServerEnabled(
            body.serverId || "",
            body.action === "enable",
          )
        : body.action === "probe"
          ? await runMcpFilesystemAcceptance()
          : registerPinnedFilesystemMcpServer(
              body.root || MCP_FILESYSTEM_ACCEPTANCE_ROOT,
            );
    return NextResponse.json({
      ok: true,
      result,
      registry: readMcpServerRegistry(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "MCP server lifecycle action failed.",
        registry: readMcpServerRegistry(),
      },
      { status: 422 },
    );
  }
}
