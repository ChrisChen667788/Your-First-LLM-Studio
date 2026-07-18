import { NextResponse } from "next/server";
import { buildExtensionEcosystemPromotionEvidence } from "@/features/extensions/extension-ecosystem-promotion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildExtensionEcosystemPromotionEvidence());
}
