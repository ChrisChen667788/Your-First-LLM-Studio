import type { AgentBenchmarkModality } from "@/lib/agent/types";

export const BENCHMARK_STANDARDS_SCHEMA_VERSION =
  "benchmark.standards.v1" as const;
export const BENCHMARK_STANDARDS_STATE_SCHEMA_VERSION =
  "benchmark.standards-state.v1" as const;

export type BenchmarkStandardSourceKind = "huggingface" | "github";

export type BenchmarkStandardCatalogEntry = {
  id: string;
  label: string;
  category:
    | "knowledge-reasoning"
    | "instruction-following"
    | "math"
    | "code"
    | "agent"
    | "multimodal"
    | "video";
  authority: string;
  summary: string;
  modalities: AgentBenchmarkModality[];
  metric: string;
  protocol: string;
  sourceKind: BenchmarkStandardSourceKind;
  sourceUrl: string;
  updateUrl: string;
  paperUrl?: string;
  dataAccess: "public" | "gated";
  adapterStatus:
    | "starter-subset"
    | "registry-only"
    | "protocol-adapter"
    | "native-adapter";
  localDatasetId?: string;
};

export type BenchmarkStandardUpstreamState = {
  standardId: string;
  status: "unchecked" | "available" | "stale" | "error";
  checkedAt?: string;
  revision?: string;
  lastModifiedAt?: string;
  etag?: string;
  error?: string;
};

export type BenchmarkStandardsState = {
  schemaVersion: typeof BENCHMARK_STANDARDS_STATE_SCHEMA_VERSION;
  updatedAt: string;
  lastRefreshAt?: string;
  sources: Record<string, BenchmarkStandardUpstreamState>;
};

export type BenchmarkStandardReadEntry = BenchmarkStandardCatalogEntry & {
  upstream: BenchmarkStandardUpstreamState;
};

export type BenchmarkStandardsReadModel = {
  ok: true;
  schemaVersion: typeof BENCHMARK_STANDARDS_SCHEMA_VERSION;
  generatedAt: string;
  autoRefreshHours: number;
  stale: boolean;
  lastRefreshAt?: string;
  totals: {
    standards: number;
    available: number;
    stale: number;
    errors: number;
    multimodal: number;
    runnable: number;
  };
  standards: BenchmarkStandardReadEntry[];
  disclosure: string;
};

export type BenchmarkStandardsRefreshRequest = {
  action: "refresh";
  standardIds?: string[];
};
