import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { searchKnowledgeBase } from "@/lib/agent/retrieval-store";
import { appendExperimentEvent } from "@/features/experiments/timeline-service";
import {
  appendRetrievalQueryReplay,
  readRetrievalQueryReplaySummary,
} from "@/features/retrieval/query-replay-store";
import type {
  AgentRetrievalEvidenceMode,
  AgentRetrievalScope,
  AgentRetrievalSourcePreference
} from "@/lib/agent/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") || "30");
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(limitParam, 120))
    : 30;
  return NextResponse.json(readRetrievalQueryReplaySummary({ limit }));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      query?: string;
      topK?: number;
      scope?: AgentRetrievalScope;
      sourcePreference?: AgentRetrievalSourcePreference;
      evidenceMode?: AgentRetrievalEvidenceMode;
    };

    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) {
      return NextResponse.json({ error: "query is required." }, { status: 400 });
    }

    const topK =
      typeof body.topK === "number" && Number.isFinite(body.topK)
        ? Math.max(1, Math.min(body.topK, 12))
        : 4;

    const retrieval = searchKnowledgeBase(query, topK, {
      scope: body.scope,
      sourcePreference: body.sourcePreference,
      evidenceMode: body.evidenceMode
    });
    const queryId = `retrieval-query-${crypto.randomUUID()}`;
    const replay = appendRetrievalQueryReplay({
      id: queryId,
      retrieval,
    });
    appendExperimentEvent({
      kind: "retrieval",
      status: "completed",
      title: "Knowledge query completed",
      summary: `${retrieval.hitCount} hit${retrieval.hitCount === 1 ? "" : "s"} · top score ${retrieval.topScore.toFixed(2)}`,
      relatedId: queryId,
      links: retrieval.results.slice(0, 8).map((result) => ({
        relation: "uses" as const,
        entityType: "document" as const,
        id: result.documentId,
        label: result.title,
      })),
      metadata: {
        queryLength: query.length,
        hitCount: retrieval.hitCount,
        topScore: retrieval.topScore,
        scope: retrieval.scope,
        evidenceMode: retrieval.evidenceMode,
        sourcePreference: retrieval.sourcePreference,
      },
    });

    return NextResponse.json({
      ok: true,
      retrieval,
      replay,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Knowledge query failed." },
      { status: 500 }
    );
  }
}
