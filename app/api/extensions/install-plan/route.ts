import { NextResponse } from "next/server";
import { createExtensionInstallPlan, readExtensionInstallPlans } from "@/features/extensions/install-planner";
import type { ExtensionManifest } from "@/features/extensions/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() { return NextResponse.json(readExtensionInstallPlans()); }
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { manifests?: ExtensionManifest[] };
    const plan = createExtensionInstallPlan(Array.isArray(body.manifests) ? body.manifests : []);
    return NextResponse.json({ ok: plan.status === "ready", plan, registry: readExtensionInstallPlans() }, { status: plan.status === "ready" ? 200 : 422 });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Install planning failed." }, { status: 400 }); }
}
