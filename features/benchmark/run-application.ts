import { NextResponse } from "next/server";
import type { BenchmarkRequestBody } from "@/features/benchmark/run-plan";
import {
  buildBenchmarkRunErrorResponse,
  createBenchmarkRunLifecycleRuntime,
  type BenchmarkRunLifecycleRuntime,
} from "@/features/benchmark/run-lifecycle";
import { executeBenchmarkRunRequest } from "@/features/benchmark/run-execution";

export async function POST(request: Request) {
  let lifecycle: BenchmarkRunLifecycleRuntime | null = null;
  try {
    const body = (await request.json()) as BenchmarkRequestBody;
    const runLifecycle = createBenchmarkRunLifecycleRuntime(body.runId);
    lifecycle = runLifecycle;
    const outcome = await executeBenchmarkRunRequest({
      body,
      lifecycle: runLifecycle,
    });
    return NextResponse.json(outcome.payload, outcome.init);
  } catch (error) {
    const response = buildBenchmarkRunErrorResponse({ runtime: lifecycle, error });
    return NextResponse.json(response.payload, response.init);
  } finally {
    lifecycle?.cleanup();
  }
}
