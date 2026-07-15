import { NextResponse } from "next/server";
import { readPostV1AcceptanceEvidence } from "@/features/experiments/post-v1-acceptance";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readPostV1AcceptanceEvidence()); }
