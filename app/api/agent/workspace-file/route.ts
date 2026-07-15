import { NextResponse } from "next/server";
import {
  readAgentWorkspaceFile,
  WorkspaceFileApplicationError,
} from "@/features/agent/workspace-file-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return NextResponse.json(
      readAgentWorkspaceFile(new URL(request.url).searchParams.get("path")),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to open workspace file." },
      { status: error instanceof WorkspaceFileApplicationError ? error.status : 400 },
    );
  }
}
