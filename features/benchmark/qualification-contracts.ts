export const BENCHMARK_QUALIFICATION_SCHEMA_VERSION =
  "benchmark.qualification.v1" as const;
export const BENCHMARK_QUALIFICATION_STORE_SCHEMA_VERSION =
  "benchmark.qualification-store.v1" as const;

export const MATH500_QUALIFICATION_STANDARD_ID = "math-500" as const;
export const MATH500_QUALIFIED_DATASET_ID = "math-500-qualified" as const;

export type BenchmarkQualificationCheckId =
  | "source-allowlist"
  | "metadata-response"
  | "immutable-revision"
  | "pinned-file-path"
  | "transfer-complete"
  | "content-digest"
  | "row-count"
  | "required-schema"
  | "unique-identifiers"
  | "split-contract"
  | "subject-coverage"
  | "level-coverage"
  | "prompt-pack-digest"
  | "evaluator-disclosure"
  | "durable-snapshot-reverify";

export type BenchmarkQualificationCheck = {
  id: BenchmarkQualificationCheckId;
  label: string;
  status: "pass" | "hold";
  summary: string;
};

export type Math500SnapshotManifest = {
  standardId: typeof MATH500_QUALIFICATION_STANDARD_ID;
  datasetId: typeof MATH500_QUALIFIED_DATASET_ID;
  repository: "HuggingFaceH4/MATH-500";
  sourceSplit: "test";
  sourceFile: "test.jsonl";
  revision: string;
  sourceUrl: string;
  downloadedAt: string;
  lastModifiedAt?: string;
  snapshotPath: string;
  bytes: number;
  sha256: string;
  rowCount: number;
  uniqueIdCount: number;
  subjects: string[];
  levels: number[];
  promptPackDigest: string;
  sampleManifestDigest: string;
  sampleManifestSize: number;
  evaluatorMode: "manual-review-compatibility";
  officialScoreEligible: false;
};

export type BenchmarkQualificationReceipt = {
  id: string;
  generatedAt: string;
  status: "pass" | "hold";
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  checks: BenchmarkQualificationCheck[];
  totals: { checks: 15; passed: number; held: number };
  manifest: Math500SnapshotManifest;
  evidenceDigest: string;
  productionBlockers: string[];
};

export type QualifiedBenchmarkDatasetSummary = {
  id: typeof MATH500_QUALIFIED_DATASET_ID;
  label: string;
  description: string;
  sourceLabel: string;
  sourceUrl: string;
  taskCategory: string;
  scoringLabel: string;
  sampleCount: number;
  revision: string;
  sha256: string;
};

export type BenchmarkQualificationReadModel = {
  ok: true;
  schemaVersion: typeof BENCHMARK_QUALIFICATION_SCHEMA_VERSION;
  generatedAt: string;
  localStatus: "pass" | "hold" | "evidence-needed";
  productionStatus: "hold";
  snapshotIntegrity: "verified" | "missing" | "mismatch" | "unchecked";
  latest: BenchmarkQualificationReceipt | null;
  latestPassing: BenchmarkQualificationReceipt | null;
  totals: { checks: 15; passed: number; held: number };
  qualifiedDataset: QualifiedBenchmarkDatasetSummary | null;
  disclosure: string;
  productionBlockers: string[];
  receiptPath: string;
};

export type BenchmarkQualificationAction = {
  action: "qualify" | "reverify";
};
