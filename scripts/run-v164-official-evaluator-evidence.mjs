import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/$/, "");
const requireFull = process.argv.includes("--require-full");

async function readJson(url, init) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json();
  if (!response.ok && response.status !== 422) {
    throw new Error(payload.error || `${url} returned HTTP ${response.status}`);
  }
  return payload.evidence || payload;
}

const evaluator = await readJson(
  `${baseUrl}/api/experiments/v164-official-evaluators`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  },
);
const officialRun = await readJson(`${baseUrl}/api/benchmarks/official-runs`);
const full = officialRun.latestEvidence;
const localStatus =
  evaluator.localStatus === "pass" && full?.complete === true ? "pass" : "hold";
const evidence = {
  schemaVersion: "v1.6.4-official-evaluator-evidence.v1",
  generatedAt: new Date().toISOString(),
  localStatus,
  productionStatus: "hold",
  evaluator: {
    localStatus: evaluator.localStatus,
    conformanceStatus: evaluator.conformanceStatus,
    totals: evaluator.acceptance?.totals || evaluator.latest?.totals || null,
    mathRuntime: evaluator.mathRuntime,
    protocols: evaluator.protocols,
    revisions: evaluator.latest?.revisions || null,
  },
  fullMath500Run: full,
  latestProgress: officialRun.latestProgress,
  blockers: evaluator.productionBlockers,
};
evidence.evidenceDigest = createHash("sha256")
  .update(JSON.stringify(evidence))
  .digest("hex");

const evidenceDirectory = path.join(root, "docs", "release-evidence");
mkdirSync(evidenceDirectory, { recursive: true });
writeFileSync(
  path.join(evidenceDirectory, "v1.6.4-official-evaluators-latest.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
);

const markdown = `# v1.6.4 Official Evaluators and Full MATH-500 Evidence

- Generated: ${evidence.generatedAt}
- Local status: **${evidence.localStatus.toUpperCase()}**
- Production status: **HOLD**
- Evaluator conformance: **${evidence.evaluator.localStatus.toUpperCase()}** (${evidence.evaluator.totals?.passed || 0}/${evidence.evaluator.totals?.slices || 0})
- Math-Verify: \`${evidence.evaluator.mathRuntime.evaluatorVersion}\` / \`${evidence.evaluator.mathRuntime.configId}\`
- Full run: ${full?.complete ? `**500/500 complete** on \`${full.resolvedModel}\`` : "not yet complete"}
- Scored/correct: ${full ? `${full.scoredSamples}/${full.correctSamples}` : "--"}
- Accuracy: ${full?.accuracy ?? "--"}%
- Run ID: \`${full?.runId || officialRun.latestProgress?.runId || "--"}\`
- Evidence digest: \`${evidence.evidenceDigest}\`

## Protocol Coverage

${evidence.evaluator.protocols
  .map(
    (entry) =>
      `- **${entry.label}**: adapter ${entry.adapterStatus}; full execution ${entry.executionStatus}. ${entry.detail}`,
  )
  .join("\n")}

## Truth Boundary

The pinned local evaluator and a complete local run are reproducible product evidence, not an external leaderboard submission, independent reproduction, or production promotion. Full multimodal datasets, licensed video assets, judge-backed extraction where required, compatible vision/video runtimes, and external submission remain separate gates.
`;
writeFileSync(
  path.join(
    evidenceDirectory,
    `v1.6.4-official-evaluators-${evidence.generatedAt.slice(0, 10)}.md`,
  ),
  markdown,
);

console.log(JSON.stringify(evidence, null, 2));
if (requireFull && localStatus !== "pass") process.exitCode = 1;
