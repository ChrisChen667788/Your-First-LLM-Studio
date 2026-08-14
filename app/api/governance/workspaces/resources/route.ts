import { NextResponse } from "next/server";
import {
  createAuthorizedWorkspaceResource,
  listAuthorizedWorkspaceResources,
  readWorkspaceAuditEvents,
  updateAuthorizedWorkspaceResource,
  WorkspaceDatabaseAuthorizationError,
  WorkspaceDatabaseConflictError,
} from "@/features/governance/workspace-acl-database";
import {
  resolveWorkspaceRequestContext,
  WorkspaceRequestContextError,
} from "@/features/governance/workspace-request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (error instanceof WorkspaceRequestContextError) {
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  if (error instanceof WorkspaceDatabaseAuthorizationError) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "workspace_access_denied", message: error.message },
      },
      { status: error.status },
    );
  }
  if (error instanceof WorkspaceDatabaseConflictError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          expectedRevision: error.expectedRevision,
          actualRevision: error.actualRevision,
        },
      },
      { status: error.status },
    );
  }
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "workspace_resource_failed",
        message:
          error instanceof Error
            ? error.message
            : "Workspace resource request failed.",
      },
    },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  try {
    const context = resolveWorkspaceRequestContext(request);
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind")?.trim() || undefined;
    const resources = listAuthorizedWorkspaceResources(context, { kind });
    const audit =
      searchParams.get("includeAudit") === "1"
        ? readWorkspaceAuditEvents(context, { limit: 50 })
        : undefined;
    return NextResponse.json({ ok: true, context, resources, audit });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = resolveWorkspaceRequestContext(request);
    const body = (await request.json().catch(() => ({}))) as {
      id?: string;
      kind?: string;
      label?: string;
    };
    const resource = createAuthorizedWorkspaceResource(context, {
      id: body.id,
      kind: body.kind || "",
      label: body.label || "",
    });
    return NextResponse.json({ ok: true, context, resource }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = resolveWorkspaceRequestContext(request);
    const body = (await request.json().catch(() => ({}))) as {
      resourceId?: string;
      label?: string;
      expectedRevision?: number;
    };
    const resource = updateAuthorizedWorkspaceResource(context, {
      resourceId: body.resourceId || "",
      label: body.label || "",
      expectedRevision: Number(body.expectedRevision || 0),
    });
    return NextResponse.json({ ok: true, context, resource });
  } catch (error) {
    return failure(error);
  }
}
