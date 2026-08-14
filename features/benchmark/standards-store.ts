import { getLocalAgentDataPath } from "@/lib/agent/data-dir";
import {
  readJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";
import {
  BENCHMARK_STANDARDS_STATE_SCHEMA_VERSION,
  type BenchmarkStandardsState,
} from "@/features/benchmark/standards-contracts";

const STANDARDS_STATE_FILE = getLocalAgentDataPath(
  "benchmark-standards-registry.json",
);

function initialState(): BenchmarkStandardsState {
  return {
    schemaVersion: BENCHMARK_STANDARDS_STATE_SCHEMA_VERSION,
    updatedAt: new Date(0).toISOString(),
    sources: {},
  };
}

function isState(value: unknown): value is BenchmarkStandardsState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<BenchmarkStandardsState>;
  return (
    candidate.schemaVersion === BENCHMARK_STANDARDS_STATE_SCHEMA_VERSION &&
    typeof candidate.updatedAt === "string" &&
    Boolean(candidate.sources) &&
    typeof candidate.sources === "object" &&
    !Array.isArray(candidate.sources)
  );
}

export function readBenchmarkStandardsState() {
  return readJsonFileDurably(STANDARDS_STATE_FILE, initialState, isState);
}

export function updateBenchmarkStandardsState(
  mutate: (current: BenchmarkStandardsState) => BenchmarkStandardsState,
) {
  return updateJsonFileDurably(
    STANDARDS_STATE_FILE,
    initialState,
    mutate,
    isState,
  );
}

export function getBenchmarkStandardsStatePath() {
  return STANDARDS_STATE_FILE;
}
