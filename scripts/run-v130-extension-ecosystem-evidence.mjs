#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(
  /\/+$/u,
  "",
);
const publish = args.includes("--publish");
const outputDir = path.join(root, "output", "release-evidence");
const outputName = "v1.3.0-mcp-extension-acceptance-2026-07-19.json";

async function fetchJson(pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(120_000),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      payload.error || `${pathname} returned HTTP ${response.status}.`,
    );
  }
  return payload;
}

const acceptanceResponse = await fetchJson("/api/extensions/acceptance", {
  method: "POST",
});
const promotion = await fetchJson("/api/extensions/promotion");
const postV1Gate = await fetchJson("/api/experiments/post-v1-promotion-gate");
const acceptance = acceptanceResponse.receipt;
const v130 = postV1Gate.versions?.find((entry) => entry.version === "v1.3.0");

if (acceptance?.status !== "pass") {
  throw new Error("The v1.3.0 local acceptance receipt did not pass.");
}
if (promotion.localStatus !== "pass") {
  throw new Error("The v1.3.0 local promotion gate did not pass.");
}
if (promotion.productionStatus !== "hold") {
  throw new Error("The v1.3.0 production gate must remain fail-closed.");
}
if (!v130 || !v130.localReady || v130.status !== "local-ready") {
  throw new Error("The post-v1 promotion gate did not mark v1.3.0 local-ready.");
}
if (v130.productionReady) {
  throw new Error("The post-v1 promotion gate incorrectly promoted v1.3.0.");
}

const evidence = {
  schemaVersion: "extensions.v1.3.0-real-ecosystem-evidence.v1",
  generatedAt: new Date().toISOString(),
  status: "local-pass",
  productionStatus: "hold",
  acceptance,
  promotion,
  postV1Gate: {
    totals: postV1Gate.totals,
    version: v130,
  },
  runner: {
    baseUrl,
    localOnly: true,
    processSandbox: acceptance.security.sandbox,
    mcpTransport: acceptance.mcp.transport,
  },
};

mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, outputName);
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

if (publish) {
  const docsPath = path.join(root, "docs", "release-evidence", outputName);
  mkdirSync(path.dirname(docsPath), { recursive: true });
  writeFileSync(docsPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

console.log(
  JSON.stringify(
    {
      status: evidence.status,
      productionStatus: evidence.productionStatus,
      checks: Object.keys(acceptance.checks).length,
      tools: acceptance.mcp.tools,
      acceptanceDigest: acceptance.evidenceDigest,
      promotionDigest: promotion.evidenceDigest,
      outputPath,
      published: publish,
    },
    null,
    2,
  ),
);
