import { NextResponse } from "next/server";
import { assertScimAuthorization, createScimResource, listScimResources } from "@/features/governance/identity-provisioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown) { const message = error instanceof Error ? error.message : "SCIM request failed."; return NextResponse.json({ schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: message, status: message.includes("disabled") ? "503" : "401" }, { status: message.includes("disabled") ? 503 : 401 }); }
export async function GET(request: Request) { try { assertScimAuthorization(request.headers.get("authorization")); return NextResponse.json(listScimResources("users")); } catch (error) { return failure(error); } }
export async function POST(request: Request) { try { assertScimAuthorization(request.headers.get("authorization")); const resource = createScimResource("users", await request.json()); return NextResponse.json(resource, { status: 201 }); } catch (error) { return failure(error); } }
