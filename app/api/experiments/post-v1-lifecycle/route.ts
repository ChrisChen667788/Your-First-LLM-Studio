import { NextResponse } from "next/server";
import { readPostV1LifecycleEvidence } from "@/features/experiments/post-v1-lifecycle";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readPostV1LifecycleEvidence()); }
