#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/, "");
const source = `${baseUrl}/api/experiments/post-v1-promotion-gate`;
const outputPath = path.join(root, "docs", "release-evidence", "post-v1-promotion-gate-2026-07-16.json");

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

const response = await fetch(source, { headers: { accept: "application/json" } });
if (!response.ok) throw new Error(`${source} returned ${response.status}.`);
const gate = await response.json();
if (gate.schemaVersion !== "experiments.post-v1-promotion-gate.v1") {
  throw new Error(`Unexpected promotion gate schema: ${gate.schemaVersion || "missing"}.`);
}
const digestSource = { ...gate };
delete digestSource.generatedAt;
const stateDigest = createHash("sha256").update(stable(digestSource)).digest("hex");
const evidence = {
  schemaVersion: "experiments.post-v1-promotion-gate-evidence.v1",
  capturedAt: new Date().toISOString(),
  source,
  integrity: { algorithm: "sha256", excludes: ["generatedAt"], stateDigest },
  gate,
};
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ok: true,
  outputPath: path.relative(root, outputPath),
  totals: gate.totals,
  stateDigest,
}, null, 2));
