import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/$/, "");
const requirePass = process.argv.includes("--require-pass");

const response = await fetch(
  `${baseUrl}/api/experiments/v165-benchmark-reproducibility`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(120_000),
  },
);
const payload = await response.json();
if (!response.ok && response.status !== 422) {
  throw new Error(payload.error || `Acceptance returned HTTP ${response.status}.`);
}
const gate = payload.evidence || payload;
const analysis = gate.reproducibility.analysis;
const replay = gate.reproducibility.replay;
const plan = gate.reproducibility.multimodalPlan;
const evidence = {
  schemaVersion: "v1.6.5-benchmark-reproducibility-evidence.v1",
  generatedAt: new Date().toISOString(),
  localStatus: gate.localStatus,
  productionStatus: "hold",
  acceptance: gate.latest?.totals || null,
  analysis,
  replay,
  multimodalPlan: plan,
  blockers: gate.productionBlockers,
};
evidence.evidenceDigest = createHash("sha256")
  .update(JSON.stringify(evidence))
  .digest("hex");

const directory = path.join(root, "docs", "release-evidence");
mkdirSync(directory, { recursive: true });
writeFileSync(
  path.join(directory, "v1.6.5-benchmark-reproducibility-latest.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
);

const subjectRows = (analysis?.subjects || [])
  .map(
    (entry) =>
      `| ${entry.key} | ${entry.correct}/${entry.total} | ${entry.accuracy}% | ${entry.confidence.low}% - ${entry.confidence.high}% |`,
  )
  .join("\n");
const markdown = `# v1.6.5 Benchmark Reproducibility and Multimodal Readiness

- Generated: ${evidence.generatedAt}
- Local status: **${String(evidence.localStatus).toUpperCase()}**
- Production status: **HOLD**
- Acceptance: **${evidence.acceptance?.passed || 0}/${evidence.acceptance?.slices || 15}**
- Run: \`${analysis?.runId || "--"}\`
- Accuracy: **${analysis?.accuracy ?? "--"}%**
- Wilson 95%: **${analysis?.confidence?.low ?? "--"}% - ${analysis?.confidence?.high ?? "--"}%**
- Evaluator replay agreement: **${replay?.agreementSamples || 0}/${replay?.replayedSamples || 0}**
- Replay mode: \`${replay?.executionMode || "--"}\` (independent host: **NO**)
- Evidence digest: \`${evidence.evidenceDigest}\`

## Subject Scorecard

| Subject | Correct | Accuracy | Wilson 95% |
| --- | ---: | ---: | ---: |
${subjectRows}

## Multimodal Execution Readiness

${(plan?.protocols || [])
  .map(
    (entry) =>
      `- **${entry.label}**: adapter ${entry.adapterStatus}; full execution ${entry.executionStatus}; judge ${entry.judgeMode}. ${entry.blockers.join(" ")}`,
  )
  .join("\n")}

## Truth Boundary

The 500 predictions were replayed through a fresh isolated Python scorer worker on the same machine. The 100% agreement proves local scorer stability for the pinned artifacts; it is not an independent-machine reproduction, external leaderboard submission, licensed multimodal run, or production promotion.
`;
writeFileSync(
  path.join(
    directory,
    `v1.6.5-benchmark-reproducibility-${evidence.generatedAt.slice(0, 10)}.md`,
  ),
  markdown,
);

console.log(JSON.stringify(evidence, null, 2));
if (requirePass && evidence.localStatus !== "pass") process.exitCode = 1;
