import { NextResponse } from "next/server";
import { readWorkspaceIdentityFoundation } from "@/features/governance/workspace-identity";
import {
  readWorkspaceAclDatabase,
  runWorkspaceIsolationRehearsal,
} from "@/features/governance/workspace-acl-database";
import { readIdentityProvisioningReadiness } from "@/features/governance/identity-provisioning";
import { readPostgresRlsEvidence } from "@/features/governance/postgres-rls-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ...readWorkspaceIdentityFoundation(), database: readWorkspaceAclDatabase(), postgresRls: readPostgresRlsEvidence(), identityProvisioning: readIdentityProvisioningReadiness() });
}

export async function POST() {
  const rehearsal = runWorkspaceIsolationRehearsal();
  return NextResponse.json({ ok: rehearsal.ok, rehearsal, database: readWorkspaceAclDatabase(), postgresRls: readPostgresRlsEvidence(), identityProvisioning: readIdentityProvisioningReadiness() }, { status: rehearsal.ok ? 200 : 500 });
}
