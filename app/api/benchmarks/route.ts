import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    schemaVersion: "benchmark.run-route.v1",
    owner: "features/benchmark",
    methods: ["POST"],
  });
}

export { POST } from "@/features/benchmark/run-application";
