import { NextResponse } from "next/server";
import { publishArtifactToLocalRegistry, readArtifactLocalRegistry } from "@/features/artifacts/local-registry";
import type { ArtifactPackageManifest } from "@/features/artifacts/package-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readArtifactLocalRegistry()); }
export async function POST(request: Request) { try { const body = await request.json().catch(() => ({})) as { manifest?: ArtifactPackageManifest; packageBase64?: string }; if (!body.manifest) throw new Error("manifest is required."); const record = publishArtifactToLocalRegistry({ manifest: body.manifest, packageBase64: body.packageBase64 || "" }); return NextResponse.json({ ok: true, record, registry: readArtifactLocalRegistry() }); } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Artifact publication failed.", registry: readArtifactLocalRegistry() }, { status: 422 }); } }
