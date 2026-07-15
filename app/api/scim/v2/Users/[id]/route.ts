import { NextResponse } from "next/server";
import { assertScimAuthorization, deleteScimResource, patchScimResource, readScimResource } from "@/features/governance/identity-provisioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failed(error: unknown) {
  const message = error instanceof Error ? error.message : "SCIM request failed.";
  const normalized = message.toLowerCase();
  const status = normalized.includes("disabled")
    ? 503
    : normalized.includes("authorization") || normalized.includes("bearer")
      ? 401
      : normalized.includes("not found")
        ? 404
        : 400;
  return NextResponse.json(
    { schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: message },
    { status },
  );
}
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { try { assertScimAuthorization(request.headers.get("authorization")); const resource = readScimResource("users", (await context.params).id); return resource ? NextResponse.json(resource) : failed(new Error("SCIM resource was not found.")); } catch (error) { return failed(error); } }
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { try { assertScimAuthorization(request.headers.get("authorization")); const body = await request.json() as { Operations?: Array<{ op?: string; path?: string; value?: unknown }> }; return NextResponse.json(patchScimResource("users", (await context.params).id, body.Operations || [])); } catch (error) { return failed(error); } }
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { try { assertScimAuthorization(request.headers.get("authorization")); deleteScimResource("users", (await context.params).id); return new NextResponse(null, { status: 204 }); } catch (error) { return failed(error); } }
