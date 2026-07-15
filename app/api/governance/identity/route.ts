import { NextResponse } from "next/server";
import { discoverOidcProvider, readIdentityProvisioningReadiness, verifyOidcIdToken } from "@/features/governance/identity-provisioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() { return NextResponse.json(readIdentityProvisioningReadiness()); }
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { action?: string; idToken?: string; nonce?: string };
    return NextResponse.json(body.action === "verify-id-token" ? await verifyOidcIdToken(body.idToken || "", body.nonce) : await discoverOidcProvider());
  }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "OIDC discovery failed.", readiness: readIdentityProvisioningReadiness() }, { status: 409 }); }
}
