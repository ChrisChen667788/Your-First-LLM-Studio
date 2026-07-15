import { NextResponse } from "next/server";
import { readPostV1ClosureEvidence } from "@/features/experiments/post-v1-closure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() { return NextResponse.json(readPostV1ClosureEvidence()); }
