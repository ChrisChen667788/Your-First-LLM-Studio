import { NextResponse } from "next/server";
import {
  applyScimGroupWorkspaceMapping,
  readIdentityWorkspaceMappingReadiness,
  runIdentityWorkspaceMappingRehearsal,
} from "@/features/governance/identity-workspace-mapping";
import type { WorkspaceRole } from "@/features/governance/workspace-acl-database";
import {
  assertTrustedOperatorRequest,
  OperatorAuthorizationError,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readIdentityWorkspaceMappingReadiness());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const body = (await request.json().catch(() => ({}))) as {
      action?: "rehearse" | "apply-scim-group";
      scimGroupId?: string;
      organizationId?: string;
      workspaceId?: string;
      role?: WorkspaceRole;
    };
    if (body.action === "apply-scim-group") {
      const mapping = applyScimGroupWorkspaceMapping({
        scimGroupId: body.scimGroupId || "",
        organizationId: body.organizationId || "",
        workspaceId: body.workspaceId || "",
        role: body.role || "viewer",
      });
      return NextResponse.json({
        ok: true,
        mapping,
        readiness: readIdentityWorkspaceMappingReadiness(),
      });
    }
    const rehearsal = runIdentityWorkspaceMappingRehearsal();
    return NextResponse.json(
      {
        ok: rehearsal.ok,
        rehearsal,
        readiness: readIdentityWorkspaceMappingReadiness(),
      },
      { status: rehearsal.ok ? 200 : 500 },
    );
  } catch (error) {
    const status = error instanceof OperatorAuthorizationError ? error.status : 400;
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Identity mapping failed.",
      },
      { status },
    );
  }
}
