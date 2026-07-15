import { NextResponse } from "next/server";
import { readPostV1HardeningEvidence } from "@/features/experiments/post-v1-hardening";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readPostV1HardeningEvidence()); }
