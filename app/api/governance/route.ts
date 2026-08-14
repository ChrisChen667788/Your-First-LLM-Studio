import { NextResponse } from "next/server";
import { readWorkspaceIdentityFoundation } from "@/features/governance/workspace-identity";
import {
  readWorkspaceAclDatabase,
  runWorkspaceIsolationRehearsal,
} from "@/features/governance/workspace-acl-database";
import { readIdentityProvisioningReadiness } from "@/features/governance/identity-provisioning";
import {
  readIdentityWorkspaceMappingReadiness,
} from "@/features/governance/identity-workspace-mapping";
import {
  readGovernanceRehearsalEvidence,
  runAndPersistGovernanceRehearsalEvidence,
} from "@/features/governance/governance-rehearsal-evidence";
import { readPostgresRlsEvidence } from "@/features/governance/postgres-rls-evidence";
import { readWorkspaceRequestContextReadiness } from "@/features/governance/workspace-request-context";
import {
  assertTrustedOperatorRequest,
  OperatorAuthorizationError,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ...readWorkspaceIdentityFoundation(), requestContext: readWorkspaceRequestContextReadiness(), database: readWorkspaceAclDatabase(), postgresRls: readPostgresRlsEvidence(), identityProvisioning: readIdentityProvisioningReadiness(), identityMapping: readIdentityWorkspaceMappingReadiness(), rehearsalEvidence: readGovernanceRehearsalEvidence() });
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const rehearsal = runWorkspaceIsolationRehearsal();
    const evidence = runAndPersistGovernanceRehearsalEvidence();
    const ok = rehearsal.ok && evidence.ok;
    return NextResponse.json({ ok, rehearsal, identityMappingRehearsal: evidence.identityMapping, conflictRehearsal: evidence.multiUserConflict, evidenceFile: evidence.evidenceFile, requestContext: readWorkspaceRequestContextReadiness(), database: readWorkspaceAclDatabase(), postgresRls: readPostgresRlsEvidence(), identityProvisioning: readIdentityProvisioningReadiness(), identityMapping: readIdentityWorkspaceMappingReadiness(), rehearsalEvidence: evidence.store }, { status: ok ? 200 : 500 });
  } catch (error) {
    const status = error instanceof OperatorAuthorizationError ? error.status : 400;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Governance rehearsal failed." }, { status });
  }
}
