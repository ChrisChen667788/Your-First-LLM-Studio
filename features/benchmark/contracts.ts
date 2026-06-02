export const BENCHMARK_CONTRACT_VERSION = "benchmark.contract.v1" as const;

export type BenchmarkContractVersion = typeof BENCHMARK_CONTRACT_VERSION;

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
