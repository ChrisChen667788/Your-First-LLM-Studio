import type { AgentBenchmarkProgress } from "@/lib/agent/types";

export const OFFICIAL_BENCHMARK_RUN_SCHEMA_VERSION =
  "benchmark.official-run.v1" as const;
export const MATH500_FULL_RUN_PREFIX = "math500-full-" as const;

export type Math500FullRunEvidence = {
  runId: string;
  generatedAt: string;
  targetId: string;
  targetLabel: string;
  resolvedModel: string;
  totalSamples: number;
  successfulSamples: number;
  scoredSamples: number;
  correctSamples: number;
  failedSamples: number;
  resumedSamples: number;
  accuracy: number | null;
  evaluatorId: string | null;
  evaluatorVersion: string | null;
  evaluatorConfigId: string | null;
  complete: boolean;
  evidenceStatus: "pass" | "hold";
  disclosure: string;
};

export type OfficialBenchmarkRunReadModel = {
  ok: true;
  schemaVersion: typeof OFFICIAL_BENCHMARK_RUN_SCHEMA_VERSION;
  generatedAt: string;
  active: boolean;
  latestProgress: AgentBenchmarkProgress | null;
  latestEvidence: Math500FullRunEvidence | null;
  recentProgress: AgentBenchmarkProgress[];
  supportedTargets: string[];
  productionStatus: "hold";
  blockers: string[];
};

export type OfficialBenchmarkRunAction = {
  action: "start" | "resume";
  runId?: string;
  targetId?: string;
  maxTokens?: number;
};
