import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { getLocalAgentDataPath } from "@/lib/agent/data-dir";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";
import {
  BENCHMARK_QUALIFICATION_SCHEMA_VERSION,
  BENCHMARK_QUALIFICATION_STORE_SCHEMA_VERSION,
  MATH500_QUALIFICATION_STANDARD_ID,
  MATH500_QUALIFIED_DATASET_ID,
  type BenchmarkQualificationCheck,
  type BenchmarkQualificationCheckId,
  type BenchmarkQualificationReadModel,
  type BenchmarkQualificationReceipt,
  type Math500SnapshotManifest,
  type QualifiedBenchmarkDatasetSummary,
} from "@/features/benchmark/qualification-contracts";

const execFileAsync = promisify(execFile);
const REPOSITORY = "HuggingFaceH4/MATH-500" as const;
const SOURCE_FILE = "test.jsonl" as const;
const EXPECTED_ROWS = 500;
const EXPECTED_SUBJECTS = 7;
const EXPECTED_LEVELS = 5;
const SAMPLE_MANIFEST_SIZE = 32;
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
const METADATA_URL = `https://huggingface.co/api/datasets/${REPOSITORY}`;
const RECEIPT_FILE = getLocalAgentDataPath(
  "benchmark-qualification-receipts.json",
);
const SNAPSHOT_ROOT = getLocalAgentDataPath("benchmark-snapshots", "math-500");

type Math500Row = {
  problem: string;
  solution: string;
  answer: string;
  subject: string;
  level: number;
  unique_id: string;
};

type Math500Metadata = {
  sha: string;
  lastModified?: string;
};

type BuildReceiptInput = {
  bytes: Buffer;
  metadata: Math500Metadata;
  snapshotPath: string;
  downloadedAt?: string;
  snapshotPersisted: boolean;
};

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function check(
  id: BenchmarkQualificationCheckId,
  label: string,
  passed: boolean,
  summary: string,
): BenchmarkQualificationCheck {
  return { id, label, status: passed ? "pass" : "hold", summary };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseMath500Snapshot(bytes: Buffer) {
  if (bytes.length === 0 || bytes.length > MAX_SNAPSHOT_BYTES) {
    throw new Error(
      `MATH-500 snapshot must be between 1 and ${MAX_SNAPSHOT_BYTES} bytes.`,
    );
  }
  const text = bytes.toString("utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const rows = lines.map((line, index) => {
    try {
      return JSON.parse(line) as unknown;
    } catch {
      throw new Error(`MATH-500 row ${index + 1} is not valid JSON.`);
    }
  });
  const validRows = rows.filter((row): row is Math500Row => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return false;
    const candidate = row as Partial<Math500Row>;
    return (
      isNonEmptyString(candidate.problem) &&
      isNonEmptyString(candidate.solution) &&
      isNonEmptyString(candidate.answer) &&
      isNonEmptyString(candidate.subject) &&
      Number.isInteger(candidate.level) &&
      isNonEmptyString(candidate.unique_id)
    );
  });
  return { rows, validRows };
}

function buildManifest(
  input: BuildReceiptInput,
  rows: Math500Row[],
): Math500SnapshotManifest {
  const subjects = [...new Set(rows.map((row) => row.subject))].sort();
  const levels = [...new Set(rows.map((row) => row.level))].sort((a, b) => a - b);
  const stride = Math.max(1, Math.floor(rows.length / SAMPLE_MANIFEST_SIZE));
  const sampleManifest = rows
    .filter((_, index) => index % stride === 0)
    .slice(0, SAMPLE_MANIFEST_SIZE)
    .map((row) => ({
      id: row.unique_id,
      subject: row.subject,
      level: row.level,
      answerDigest: sha256(row.answer),
    }));
  const sourceUrl = `https://huggingface.co/datasets/${REPOSITORY}/resolve/${input.metadata.sha}/${SOURCE_FILE}`;
  return {
    standardId: MATH500_QUALIFICATION_STANDARD_ID,
    datasetId: MATH500_QUALIFIED_DATASET_ID,
    repository: REPOSITORY,
    sourceSplit: "test",
    sourceFile: SOURCE_FILE,
    revision: input.metadata.sha,
    sourceUrl,
    downloadedAt: input.downloadedAt || new Date().toISOString(),
    lastModifiedAt: input.metadata.lastModified,
    snapshotPath: input.snapshotPath,
    bytes: input.bytes.length,
    sha256: sha256(input.bytes),
    rowCount: rows.length,
    uniqueIdCount: new Set(rows.map((row) => row.unique_id)).size,
    subjects,
    levels,
    promptPackDigest: sha256(
      JSON.stringify(
        rows.map((row) => ({ id: row.unique_id, problem: row.problem })),
      ),
    ),
    sampleManifestDigest: sha256(JSON.stringify(sampleManifest)),
    sampleManifestSize: sampleManifest.length,
    evaluatorMode: "manual-review-compatibility",
    officialScoreEligible: false,
  };
}

export function buildMath500QualificationReceipt(
  input: BuildReceiptInput,
): BenchmarkQualificationReceipt {
  const parsed = parseMath500Snapshot(input.bytes);
  const rows = parsed.validRows;
  const revisionValid = /^[a-f0-9]{40}$/i.test(input.metadata.sha);
  const manifest = buildManifest(input, rows);
  const schemaValid = parsed.rows.length === parsed.validRows.length;
  const digestValid = /^[a-f0-9]{64}$/i.test(manifest.sha256);
  const checks = [
    check(
      "source-allowlist",
      "Official source allowlist",
      new URL(METADATA_URL).hostname === "huggingface.co" &&
        manifest.repository === REPOSITORY,
      `Only ${REPOSITORY} on huggingface.co is accepted.`,
    ),
    check(
      "metadata-response",
      "Official metadata response",
      isNonEmptyString(input.metadata.sha),
      input.metadata.lastModified
        ? `Metadata revision was last modified ${input.metadata.lastModified}.`
        : "Metadata supplied an upstream revision.",
    ),
    check(
      "immutable-revision",
      "Immutable revision pin",
      revisionValid,
      revisionValid
        ? `Pinned full commit ${input.metadata.sha}.`
        : "A full 40-character commit SHA is required.",
    ),
    check(
      "pinned-file-path",
      "Pinned source file",
      revisionValid && manifest.sourceUrl.includes(`/${input.metadata.sha}/${SOURCE_FILE}`),
      `${SOURCE_FILE} is resolved through the immutable revision URL.`,
    ),
    check(
      "transfer-complete",
      "Bounded transfer",
      input.bytes.length > 0 && input.bytes.length <= MAX_SNAPSHOT_BYTES,
      `${input.bytes.length.toLocaleString()} bytes downloaded within the 2 MiB ceiling.`,
    ),
    check(
      "content-digest",
      "Content SHA-256",
      digestValid,
      `Snapshot digest ${manifest.sha256}.`,
    ),
    check(
      "row-count",
      "Official row count",
      manifest.rowCount === EXPECTED_ROWS,
      `${manifest.rowCount}/${EXPECTED_ROWS} non-empty JSONL rows validated.`,
    ),
    check(
      "required-schema",
      "Required row schema",
      schemaValid,
      `${rows.length}/${parsed.rows.length} rows include problem, solution, answer, subject, level, and unique_id.`,
    ),
    check(
      "unique-identifiers",
      "Unique sample identifiers",
      manifest.uniqueIdCount === EXPECTED_ROWS,
      `${manifest.uniqueIdCount}/${EXPECTED_ROWS} unique_id values are unique.`,
    ),
    check(
      "split-contract",
      "Official test split",
      manifest.sourceSplit === "test" &&
        rows.every((row) => row.unique_id.startsWith("test/")),
      "Every sample identifier belongs to the official test split.",
    ),
    check(
      "subject-coverage",
      "Subject coverage",
      manifest.subjects.length === EXPECTED_SUBJECTS,
      `${manifest.subjects.length}/${EXPECTED_SUBJECTS} official subject groups found.`,
    ),
    check(
      "level-coverage",
      "Difficulty coverage",
      manifest.levels.length === EXPECTED_LEVELS &&
        manifest.levels.every((level, index) => level === index + 1),
      `Difficulty levels: ${manifest.levels.join(", ") || "none"}.`,
    ),
    check(
      "prompt-pack-digest",
      "Deterministic prompt pack",
      /^[a-f0-9]{64}$/i.test(manifest.promptPackDigest) &&
        manifest.sampleManifestSize === SAMPLE_MANIFEST_SIZE,
      `${manifest.sampleManifestSize} manifest samples and full prompt-pack digest ${manifest.promptPackDigest}.`,
    ),
    check(
      "evaluator-disclosure",
      "Evaluator disclosure",
      manifest.evaluatorMode === "manual-review-compatibility" &&
        manifest.officialScoreEligible === false,
      "Runnable prompts retain reference answers, but no official leaderboard score is emitted.",
    ),
    check(
      "durable-snapshot-reverify",
      "Durable snapshot reverify",
      input.snapshotPersisted &&
        existsSync(input.snapshotPath) &&
        sha256(readFileSync(input.snapshotPath)) === manifest.sha256,
      input.snapshotPersisted
        ? "Persisted snapshot digest matches the qualification receipt."
        : "Snapshot has not been persisted yet.",
    ),
  ] satisfies BenchmarkQualificationCheck[];
  const passed = checks.filter((entry) => entry.status === "pass").length;
  const evidenceDigest = sha256(
    JSON.stringify({
      manifest,
      checks: checks.map(({ id, status }) => ({ id, status })),
    }),
  );
  return {
    id: `benchmark-qualification-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    status: passed === 15 ? "pass" : "hold",
    localStatus: passed === 15 ? "pass" : "hold",
    productionStatus: "hold",
    checks,
    totals: { checks: 15, passed, held: 15 - passed },
    manifest,
    evidenceDigest,
    productionBlockers: [
      "This v1.6.3 qualification receipt does not contain evaluator output; pinned Math-Verify scoring and the completed 500-item run are reported separately by the v1.6.4 evidence read model.",
      "A qualified local snapshot proves dataset provenance, not an official leaderboard score or production deployment.",
    ],
  };
}

async function curl(url: string) {
  const result = await execFileAsync(
    "curl",
    [
      "--fail",
      "--silent",
      "--show-error",
      "--location",
      "--max-time",
      "60",
      "--retry",
      "2",
      "--user-agent",
      "First-LLM-Studio-Benchmark-Qualification/1.0",
      url,
    ],
    {
      encoding: null,
      maxBuffer: MAX_SNAPSHOT_BYTES,
      timeout: 70_000,
    },
  );
  return result.stdout;
}

async function fetchMetadata(): Promise<Math500Metadata> {
  const raw = await curl(METADATA_URL);
  const payload = JSON.parse(String(raw)) as { sha?: unknown; lastModified?: unknown };
  if (!isNonEmptyString(payload.sha)) {
    throw new Error("Official MATH-500 metadata did not include a revision.");
  }
  return {
    sha: payload.sha,
    lastModified: isNonEmptyString(payload.lastModified)
      ? payload.lastModified
      : undefined,
  };
}

async function downloadSnapshot(metadata: Math500Metadata) {
  const sourceUrl = `https://huggingface.co/datasets/${REPOSITORY}/resolve/${metadata.sha}/${SOURCE_FILE}`;
  const raw = await curl(sourceUrl);
  return Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
}

function persistSnapshot(revision: string, bytes: Buffer) {
  const snapshotDirectory = path.join(SNAPSHOT_ROOT, revision);
  const snapshotPath = path.join(snapshotDirectory, SOURCE_FILE);
  mkdirSync(snapshotDirectory, { recursive: true });
  const temporaryPath = `${snapshotPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporaryPath, bytes, { flag: "wx" });
    renameSync(temporaryPath, snapshotPath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
  return snapshotPath;
}

function persistReceipt(receipt: BenchmarkQualificationReceipt) {
  prependDurableReceipt(
    RECEIPT_FILE,
    BENCHMARK_QUALIFICATION_STORE_SCHEMA_VERSION,
    receipt,
    50,
  );
  return receipt;
}

export async function qualifyMath500Snapshot() {
  const metadata = await fetchMetadata();
  if (!/^[a-f0-9]{40}$/i.test(metadata.sha)) {
    throw new Error("Official MATH-500 revision is not a full commit SHA.");
  }
  const bytes = await downloadSnapshot(metadata);
  const snapshotPath = persistSnapshot(metadata.sha, bytes);
  return persistReceipt(
    buildMath500QualificationReceipt({
      bytes,
      metadata,
      snapshotPath,
      snapshotPersisted: true,
    }),
  );
}

export function reverifyMath500Snapshot() {
  const latest = readDurableReceipts<BenchmarkQualificationReceipt>(
    RECEIPT_FILE,
    BENCHMARK_QUALIFICATION_STORE_SCHEMA_VERSION,
  )[0];
  if (!latest) {
    throw new Error("No MATH-500 qualification receipt exists. Run qualify first.");
  }
  if (!existsSync(latest.manifest.snapshotPath)) {
    throw new Error("The qualified MATH-500 snapshot is missing from durable storage.");
  }
  return persistReceipt(
    buildMath500QualificationReceipt({
      bytes: readFileSync(latest.manifest.snapshotPath),
      metadata: {
        sha: latest.manifest.revision,
        lastModified: latest.manifest.lastModifiedAt,
      },
      snapshotPath: latest.manifest.snapshotPath,
      downloadedAt: latest.manifest.downloadedAt,
      snapshotPersisted: true,
    }),
  );
}

function datasetSummary(
  receipt: BenchmarkQualificationReceipt | null,
): QualifiedBenchmarkDatasetSummary | null {
  if (!receipt || receipt.localStatus !== "pass") return null;
  return {
    id: MATH500_QUALIFIED_DATASET_ID,
    label: "HuggingFaceH4/MATH-500 (qualified snapshot)",
    description:
      "Immutable official test snapshot with provenance and schema checks, wired to the pinned Hugging Face Math-Verify evaluator.",
    sourceLabel: `Hugging Face · ${REPOSITORY}@${receipt.manifest.revision.slice(0, 12)}`,
    sourceUrl: receipt.manifest.sourceUrl,
    taskCategory: "Mathematical reasoning",
    scoringLabel: "Math-Verify 0.9.0 equivalence · full-run evidence gated",
    sampleCount: receipt.manifest.rowCount,
    revision: receipt.manifest.revision,
    sha256: receipt.manifest.sha256,
  };
}

export function readBenchmarkQualification(): BenchmarkQualificationReadModel {
  const receipts = readDurableReceipts<BenchmarkQualificationReceipt>(
    RECEIPT_FILE,
    BENCHMARK_QUALIFICATION_STORE_SCHEMA_VERSION,
  );
  const latest = receipts[0] || null;
  const latestPassing =
    receipts.find((receipt) => receipt.localStatus === "pass") || null;
  let snapshotIntegrity: BenchmarkQualificationReadModel["snapshotIntegrity"] =
    latest ? "unchecked" : "missing";
  if (latest) {
    if (!existsSync(latest.manifest.snapshotPath)) {
      snapshotIntegrity = "missing";
    } else {
      snapshotIntegrity =
        sha256(readFileSync(latest.manifest.snapshotPath)) === latest.manifest.sha256
          ? "verified"
          : "mismatch";
    }
  }
  const effectivePassing =
    snapshotIntegrity === "verified" && latest?.localStatus === "pass"
      ? latest
      : null;
  return {
    ok: true,
    schemaVersion: BENCHMARK_QUALIFICATION_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localStatus: effectivePassing ? "pass" : latest ? "hold" : "evidence-needed",
    productionStatus: "hold",
    snapshotIntegrity,
    latest,
    latestPassing,
    totals: latest?.totals || { checks: 15, passed: 0, held: 15 },
    qualifiedDataset: datasetSummary(effectivePassing),
    disclosure:
      "Qualification pins and verifies the official MATH-500 test snapshot. This v1.6.3 receipt remains dataset-only; the separate v1.6.4 panel reports pinned Math-Verify and full-run evidence.",
    productionBlockers: latest?.productionBlockers || [
      "MATH-500 has not been qualified on this machine.",
    ],
    receiptPath: RECEIPT_FILE,
  };
}

export function readQualifiedMath500Rows() {
  const model = readBenchmarkQualification();
  const receipt = model.latestPassing;
  if (
    model.snapshotIntegrity !== "verified" ||
    !receipt ||
    !existsSync(receipt.manifest.snapshotPath)
  ) {
    return null;
  }
  return parseMath500Snapshot(readFileSync(receipt.manifest.snapshotPath)).validRows;
}

export function getBenchmarkQualificationPaths() {
  return { receiptPath: RECEIPT_FILE, snapshotRoot: SNAPSHOT_ROOT };
}
