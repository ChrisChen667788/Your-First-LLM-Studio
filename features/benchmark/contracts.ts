export const BENCHMARK_CONTRACT_VERSION = "benchmark.contract.v1" as const;
export const BENCHMARK_RELEASE_EVIDENCE_SUMMARY_VERSION = "benchmark.release-evidence-summary.v1" as const;

export type BenchmarkContractVersion = typeof BENCHMARK_CONTRACT_VERSION;
export type BenchmarkReleaseEvidenceSummaryVersion =
  typeof BENCHMARK_RELEASE_EVIDENCE_SUMMARY_VERSION;

export type BenchmarkRouteOwner = {
  route: string;
  owner: "features/benchmark";
  adminOnly?: boolean;
};

export const BENCHMARK_ROUTE_OWNERS: BenchmarkRouteOwner[] = [
  {
    route: "/benchmarks",
    owner: "features/benchmark",
  },
  {
    route: "/admin",
    owner: "features/benchmark",
    adminOnly: true,
  },
];

export type BenchmarkWorkflowStep =
  | "target-selection"
  | "workload-selection"
  | "run-control"
  | "baseline-review"
  | "release-evidence";

export type BenchmarkWorkflowContract = {
  contractVersion: BenchmarkContractVersion;
  route: "/benchmarks";
  owner: "features/benchmark";
  steps: BenchmarkWorkflowStep[];
  adminMirror: "/admin";
};

export const BENCHMARK_WORKFLOW_CONTRACT: BenchmarkWorkflowContract = {
  contractVersion: BENCHMARK_CONTRACT_VERSION,
  route: "/benchmarks",
  owner: "features/benchmark",
  steps: [
    "target-selection",
    "workload-selection",
    "run-control",
    "baseline-review",
    "release-evidence",
  ],
  adminMirror: "/admin",
};

export type BenchmarkReleaseEvidenceSummaryTotals = {
  evidenceCount: number;
  matchedRunCount: number;
  missingRunCount: number;
  groupCount: number;
  targetCount: number;
  resultCount: number;
  totalRuns: number;
  okRuns: number;
  failedRuns: number;
  skippedRuns: number;
  successRatePct: number;
  scoredResultCount: number;
  averagePassRatePct: number | null;
  averageScore: number | null;
};

export type BenchmarkReleaseEvidenceGroup = {
  key: string;
  label: string;
  mode: string;
  evidenceCount: number;
  runCount: number;
  resultCount: number;
  totalRuns: number;
  okRuns: number;
  failedRuns: number;
  skippedRuns: number;
  successRatePct: number;
  averagePassRatePct: number | null;
  averageScore: number | null;
  avgFirstTokenLatencyMs: number;
  avgLatencyMs: number;
  avgTokenThroughputTps: number;
  latestRunId?: string;
  latestGeneratedAt?: string;
  targetLabels: string[];
  notes: string[];
};

export type BenchmarkReleaseEvidenceSummaryEntry = {
  id: string;
  runId: string;
  label: string;
  pinnedAt: string;
  generatedAt?: string;
  status: "matched" | "missing-run";
  groupKey?: string;
  note?: string;
  matchSource?: "exact-run-id" | "missing-run";
  resultCount: number;
  totalRuns: number;
  okRuns: number;
  failedRuns: number;
  skippedRuns: number;
  successRatePct: number;
};

export type BenchmarkReleaseEvidenceSummary = {
  schemaVersion: BenchmarkReleaseEvidenceSummaryVersion;
  generatedAt: string;
  totals: BenchmarkReleaseEvidenceSummaryTotals;
  groups: BenchmarkReleaseEvidenceGroup[];
  entries: BenchmarkReleaseEvidenceSummaryEntry[];
  releaseNoteDraft: string[];
};
