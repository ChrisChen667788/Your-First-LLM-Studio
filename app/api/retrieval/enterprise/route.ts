import { NextResponse } from "next/server";
import {
  indexEnterpriseDocument,
  migrateEnterpriseRetrieval,
  readEnterpriseRetrievalReadModel,
  searchEnterpriseRetrieval,
  type EnterpriseRetrievalPrincipal,
} from "@/features/retrieval/enterprise-service";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readEnterpriseRetrievalReadModel());
}

function requestPrincipal(request: Request): EnterpriseRetrievalPrincipal {
  return {
    workspaceId: request.headers.get("x-first-llm-workspace-id") || "",
    subjectId: request.headers.get("x-first-llm-subject-id") || "",
    groupIds: (request.headers.get("x-first-llm-group-ids") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: "migrate" | "index" | "query";
      document?: Parameters<typeof indexEnterpriseDocument>[0]["document"];
      query?: string;
      topK?: number;
    };
    if (body.action === "migrate") {
      assertTrustedOperatorRequest(request);
      return NextResponse.json(await migrateEnterpriseRetrieval());
    }
    if (body.action === "index") {
      assertTrustedOperatorRequest(request);
      if (!body.document) throw new Error("document is required for index.");
      return NextResponse.json(
        await indexEnterpriseDocument({
          principal: requestPrincipal(request),
          document: body.document,
        }),
      );
    }
    if (body.action === "query") {
      return NextResponse.json(
        await searchEnterpriseRetrieval({
          principal: requestPrincipal(request),
          query: body.query || "",
          topK: body.topK,
        }),
      );
    }
    return NextResponse.json({ error: "Unsupported enterprise retrieval action." }, { status: 400 });
  } catch (error) {
    const candidate = error as { status?: unknown };
    const status =
      typeof candidate.status === "number"
        ? candidate.status
        : operatorAuthorizationStatus(error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Enterprise retrieval failed." },
      { status },
    );
  }
}
