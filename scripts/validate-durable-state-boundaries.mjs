import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_ROOTS = ["app", "features", "lib"];
const DURABLE_IMPORT = /durable-(?:json|receipt|list)-store|durable-json-file/u;
const DIRECT_WRITE = /writeFileSync|\.writeFile\s*\(/u;
const DIRECT_READ = /readFileSync|\.readFile\s*\(/u;

const EXEMPTIONS = new Map([
  ["features/desktop/apple-release-signing.ts", "Signed release manifests, notarization logs, and handoff artifacts."],
  ["features/desktop/onboarding-release.ts", "Materialized aggregate release evidence snapshot."],
  ["features/desktop/package-rehearsal.ts", "Immutable per-run package rehearsal reports and isolated fixture files."],
  ["features/experiments/ga-release-evidence-bundle.ts", "Export-only GA evidence bundle assembly."],
  ["features/extensions/package-verification.ts", "Immutable verification and quarantine receipts stored per package."],
  ["features/persistence/durable-json-store.ts", "Durable adapter implementation."],
  ["lib/agent/log-store.ts", "Append-only JSONL observability logs."],
  ["lib/agent/retrieval-vector-store.ts", "Derived and rebuildable vector index cache."],
  ["lib/agent/timeline-store.ts", "Append-only JSONL timeline."],
  ["lib/finetune/dataset-service.ts", "Materialized dataset export files; dataset metadata uses the durable repository."],
]);

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const absolute = path.join(directory, name);
    return statSync(absolute).isDirectory() ? walk(absolute) : [absolute];
  });
}

const candidates = SOURCE_ROOTS
  .flatMap((root) => walk(path.join(ROOT, root)))
  .filter((filePath) => filePath.endsWith(".ts") || filePath.endsWith(".tsx"))
  .map((filePath) => ({
    filePath,
    relative: path.relative(ROOT, filePath).split(path.sep).join("/"),
    source: readFileSync(filePath, "utf8"),
  }))
  .filter(({ source }) => DIRECT_WRITE.test(source)
    && DIRECT_READ.test(source)
    && source.includes("JSON.stringify")
    && source.includes("JSON.parse"));

const unknown = candidates.filter(({ relative, source }) =>
  !DURABLE_IMPORT.test(source) && !EXEMPTIONS.has(relative));
const staleExemptions = [...EXEMPTIONS.keys()].filter((relative) =>
  !candidates.some((candidate) => candidate.relative === relative));

const report = {
  schemaVersion: "persistence.durable-state-boundaries.v1",
  generatedAt: new Date().toISOString(),
  status: unknown.length || staleExemptions.length ? "failed" : "pass",
  scanned: candidates.length,
  durable: candidates.filter(({ source }) => DURABLE_IMPORT.test(source)).map(({ relative }) => relative),
  exemptions: [...EXEMPTIONS].map(([file, reason]) => ({ file, reason })),
  unknown: unknown.map(({ relative }) => relative),
  staleExemptions,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.status !== "pass") process.exitCode = 1;
