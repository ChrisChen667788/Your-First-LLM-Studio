import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    starter: {
      vectorStore: process.env.ENTERPRISE_RAG_VECTOR_STORE ?? "pgvector",
      hybridSearch: true,
      reranker: process.env.ENTERPRISE_RAG_RERANKER ?? "local-cross-encoder",
      citations: true,
      acl: true
    },
    datasets: [],
    checks: []
  });
}
