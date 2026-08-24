import { NextResponse } from "next/server";

import {
  buildWorkspaceActionProvenance,
  readWorkspaceActionProvenanceEvidence,
  recordWorkspaceActionProvenance,
} from "@/features/governance/workspace-action-provenance";
import {
  WorkspaceRequestContextError,
} from "@/features/governance/workspace-request-context";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (error instanceof WorkspaceRequestContextError) {
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "workspace_provenance_failed",
        message:
          error instanceof Error
            ? error.message
            : "Workspace provenance request failed.",
      },
    },
    { status: operatorAuthorizationStatus(error) },
  );
}

export async function GET(request: Request) {
  try {
    const execution = new URL(request.url).searchParams.get("execution");
    return NextResponse.json({
      ...buildWorkspaceActionProvenance(request, { execution }),
      evidence: readWorkspaceActionProvenanceEvidence(),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const body = (await request.json().catch(() => ({}))) as { execution?: string };
    const result = recordWorkspaceActionProvenance(request, {
      execution: body.execution,
    });
    return NextResponse.json(
      {
        ok: true,
        ...result,
        evidence: readWorkspaceActionProvenanceEvidence(),
      },
      { status: 201 },
    );
  } catch (error) {
    return failure(error);
  }
}
