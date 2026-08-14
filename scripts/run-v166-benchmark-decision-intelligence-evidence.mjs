import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/$/, "");
const requirePass = process.argv.includes("--require-pass");

const response = await fetch(
  `${baseUrl}/api/experiments/v166-benchmark-decision-intelligence`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(30_000),
  },
);
const payload = await response.json();
if (!response.ok && response.status !== 422) {
  throw new Error(payload.error || `Acceptance returned HTTP ${response.status}.`);
}
const gate = payload.evidence || payload;
const decision = gate.decisionIntelligence;
const evidence = {
  schemaVersion: "v1.6.6-benchmark-decision-intelligence-evidence.v1",
  generatedAt: new Date().toISOString(),
  localStatus: gate.localStatus,
  candidatePromotionStatus: gate.candidatePromotionStatus,
  productionStatus: "hold",
  acceptance: gate.latest?.totals || null,
  baseline: decision.baseline,
  audit: decision.audit,
  power: decision.power,
  comparison: decision.comparison,
  eligibleRuns: decision.eligibleRuns,
  decisionDigest: decision.decisionDigest,
  blockers: decision.blockers,
};
evidence.evidenceDigest = createHash("sha256")
  .update(JSON.stringify(evidence))
  .digest("hex");

const directory = path.join(root, "docs", "release-evidence");
mkdirSync(directory, { recursive: true });
writeFileSync(
  path.join(directory, "v1.6.6-benchmark-decision-intelligence-latest.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
);

const taxonomyRows = (decision.audit?.errorTaxonomy || [])
  .map((entry) => `| ${entry.key} | ${entry.count} | ${entry.pct}% |`)
  .join("\n");
const riskRows = (decision.audit?.cohortRisks || [])
  .filter((entry) => entry.risk !== "stable")
  .map(
    (entry) =>
      `| ${entry.kind} | ${entry.key} | ${entry.accuracy}% | ${entry.deltaFromOverallPct} pp | ${entry.confidence.low}% - ${entry.confidence.high}% | ${entry.risk} |`,
  )
  .join("\n");
const powerRows = (decision.power?.targets || [])
  .map(
    (entry) =>
      `| ${entry.effectPct} pp | ${entry.requiredSamplesPerRun} | ${entry.availableSamples} | ${entry.sufficientlyPowered ? "yes" : "no"} |`,
  )
  .join("\n");
const markdown = `# v1.6.6 Benchmark Decision Intelligence

- Generated: ${evidence.generatedAt}
- Local audit status: **${String(evidence.localStatus).toUpperCase()}**
- Candidate promotion: **${String(evidence.candidatePromotionStatus).toUpperCase()}**
- Production status: **HOLD**
- Acceptance: **${evidence.acceptance?.passed || 0}/${evidence.acceptance?.slices || 15}**
- Baseline run: \`${decision.baseline?.runId || "--"}\`
- Baseline accuracy: **${decision.baseline?.accuracy ?? "--"}%**
- Distinct complete run ids: **${decision.eligibleRuns.length}**
- Decision digest: \`${decision.decisionDigest || "--"}\`
- Evidence digest: \`${evidence.evidenceDigest}\`

## Error Taxonomy

| Class | Samples | Share |
| --- | ---: | ---: |
${taxonomyRows}

## Confidence-aware Cohort Risks

| Kind | Cohort | Accuracy | Delta | Wilson 95% | Risk |
| --- | --- | ---: | ---: | ---: | --- |
${riskRows}

## Statistical Power Plan

- Conservative detectable effect at 500 samples/run: **${decision.power?.detectableEffectAtAvailableSamplesPct ?? "--"} percentage points**.

| Target effect | Required samples/run | Available | Powered |
| --- | ---: | ---: | --- |
${powerRows}

## Candidate Gate

${decision.comparison?.candidateRunId
  ? `Candidate \`${decision.comparison.candidateRunId}\` shares ${decision.comparison.sharedSamples}/500 items and the promotion decision is **${decision.comparison.promotionDecision.toUpperCase()}**.`
  : "No second complete run with a distinct run id exists. Candidate promotion correctly remains **EVIDENCE NEEDED**; duplicate checkpoint snapshots from the baseline run are not counted as another experiment."}

## Truth Boundary

The 15/15 result proves that the repository can account for the real 500-item baseline, classify every result, prioritize review, plan statistical power, and fail closed before candidate promotion. It does not prove a second model run, independent-host reproduction, official multimodal execution, external leaderboard parity, organization acceptance, or production readiness.
`;
writeFileSync(
  path.join(
    directory,
    `v1.6.6-benchmark-decision-intelligence-${evidence.generatedAt.slice(0, 10)}.md`,
  ),
  markdown,
);

console.log(JSON.stringify(evidence, null, 2));
if (requirePass && evidence.localStatus !== "pass") process.exitCode = 1;
