import { NextResponse } from "next/server";
import {
  readRuntimeOperationPortEvidence,
  resolveRuntimeOperation,
  runRuntimeOperationContractSuite,
  type RuntimeBackend,
} from "@/features/runtime/operation-port";
import type { RuntimeFabricOperation } from "@/features/runtime/runtime-fabric-contract";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: Request) { const url = new URL(request.url); const backend = url.searchParams.get("backend") as RuntimeBackend | null; const action = url.searchParams.get("action") as RuntimeFabricOperation | null; return NextResponse.json({ ...readRuntimeOperationPortEvidence(), resolution: backend && action ? resolveRuntimeOperation(backend, action) : null }); }
export async function POST() { const receipt = runRuntimeOperationContractSuite(); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readRuntimeOperationPortEvidence() }, { status: receipt.status === "pass" ? 200 : 422 }); }
