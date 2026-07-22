#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/u, "");
const publish = args.includes("--publish");
const outputDir = path.join(root, "output", "release-evidence");
const outputName = "v1.3.1-workflow-studio-acceptance-2026-07-23.json";

async function fetchJson(pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(120_000),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || payload.error?.message || `${pathname} returned HTTP ${response.status}.`);
  return payload;
}

const acceptanceResponse = await fetchJson("/api/workflows/acceptance", { method: "POST", body: "{}" });
const acceptance = acceptanceResponse.receipt;
const promotion = await fetchJson("/api/workflows/promotion");
const postV1Gate = await fetchJson("/api/experiments/post-v1-promotion-gate");
const v131 = postV1Gate.versions?.find((entry) => entry.version === "v1.3.1");

if (acceptance?.status !== "pass" || !Object.values(acceptance.checks || {}).every(Boolean)) throw new Error("The v1.3.1 local acceptance receipt did not pass every check.");
if (promotion.localStatus !== "pass") throw new Error("The v1.3.1 local promotion gate did not pass.");
if (promotion.productionStatus !== "blocked") throw new Error("The v1.3.1 production gate must remain fail-closed.");
if (!v131?.localReady || v131.status !== "externally-blocked" || v131.productionReady) throw new Error("The post-v1 promotion gate did not preserve the v1.3.1 local-ready/production-blocked boundary.");

const evidence = {
  schemaVersion: "workflows.v1.3.1-studio-evidence.v1",
  generatedAt: new Date().toISOString(),
  status: "local-pass",
  productionStatus: "blocked",
  acceptance,
  promotion,
  postV1Gate: { totals: postV1Gate.totals, version: v131 },
  runner: { baseUrl, localOnly: true, graphDigest: acceptance.graph.digest, reportDigest: acceptance.reportDigest },
};

mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, outputName);
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
if (publish) {
  const docsPath = path.join(root, "docs", "release-evidence", outputName);
  mkdirSync(path.dirname(docsPath), { recursive: true });
  writeFileSync(docsPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify({ status: evidence.status, productionStatus: evidence.productionStatus, checks: Object.keys(acceptance.checks).length, graphDigest: acceptance.graph.digest, reportDigest: acceptance.reportDigest, outputPath, published: publish }, null, 2));
