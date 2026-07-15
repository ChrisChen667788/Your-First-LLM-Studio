import { NextResponse } from "next/server";
import { readModelContentAddressIndex } from "@/features/models/content-address-index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() { return NextResponse.json(readModelContentAddressIndex()); }
