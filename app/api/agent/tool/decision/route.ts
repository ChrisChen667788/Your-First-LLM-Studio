import { NextResponse } from "next/server";
import {
  AgentToolDecisionApplicationError,
  runAgentToolDecision,
} from "@/features/agent/tool-decision-application";
import type { AgentToolDecisionRequest } from "@/lib/agent/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AgentToolDecisionRequest>;
    return NextResponse.json(await runAgentToolDecision(body));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      {
        status: error instanceof AgentToolDecisionApplicationError
          ? error.status
          : 500,
      },
    );
  }
}
