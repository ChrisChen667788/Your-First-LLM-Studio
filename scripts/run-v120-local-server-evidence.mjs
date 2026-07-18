#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const value = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(
  /\/+$/u,
  "",
);
const model = value("--model", "qwen3:0.6b");
const publishPath = value("--publish");

async function request(pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15 * 60_000),
  });
  const payload = await response.json();
  if (!response.ok && !payload.receipt) {
    throw new Error(
      payload.error || `${pathname} returned HTTP ${response.status}.`,
    );
  }
  return payload;
}

console.log(`[v1.2.0] running 15 Local Server slices with ${model}`);
const acceptance = await request("/api/models/local-server-acceptance", {
  method: "POST",
  body: JSON.stringify({ model }),
});
if (acceptance.receipt?.status !== "pass") {
  const blockers = acceptance.receipt?.blockers || [
    "No passing acceptance receipt was returned.",
  ];
  throw new Error(`Local Server acceptance is HOLD: ${blockers.join(" ")}`);
}
const promotion = await request("/api/models/local-server-promotion");
const evidence = {
  schemaVersion: "models.v1.2.0-real-local-server-evidence.v1",
  generatedAt: new Date().toISOString(),
  status:
    promotion.localStatus === "pass" ? "local-pass" : "evidence-needed",
  acceptance: acceptance.receipt,
  promotion,
};
const outputPath = path.join(
  root,
  "output",
  "release-evidence",
  "v1.2.0-local-server-acceptance.json",
);
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
if (publishPath) {
  const resolved = path.resolve(root, publishPath);
  mkdirSync(path.dirname(resolved), { recursive: true });
  writeFileSync(resolved, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}
console.log(
  JSON.stringify(
    {
      status: evidence.status,
      model,
      runtimeVersion: acceptance.receipt.runtime.version,
      slices: acceptance.receipt.totals,
      acceptanceDigest: acceptance.receipt.evidenceDigest,
      promotionDigest: promotion.evidenceDigest,
      productionStatus: promotion.productionStatus,
      productionBlockers: promotion.productionBlockers,
      outputPath,
      publishPath: publishPath || null,
    },
    null,
    2,
  ),
);
