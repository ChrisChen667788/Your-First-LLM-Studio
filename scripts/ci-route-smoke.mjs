#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/, "");
const reportPath = path.join(root, "output", "ci-route-smoke.json");
const checks = [
  { id: "home", path: "/", kind: "html" },
  { id: "agent", path: "/agent", kind: "html" },
  { id: "benchmarks", path: "/benchmarks", kind: "html" },
  { id: "admin", path: "/admin", kind: "html" },
  { id: "release", path: "/release", kind: "html" },
  { id: "release-train", path: "/api/experiments/release-train", kind: "json" },
];

const results = [];
for (const check of checks) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}${check.path}`, {
      headers: { accept: check.kind === "json" ? "application/json" : "text/html" },
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.text();
    const contentOk = check.kind === "json"
      ? (() => {
          try {
            const parsed = JSON.parse(body);
            return parsed?.ok === true && Array.isArray(parsed.milestones);
          } catch {
            return false;
          }
        })()
      : body.length > 500 && !/Unhandled Runtime Error|Internal Server Error/i.test(body);
    results.push({
      ...check,
      status: response.status,
      ok: response.ok && contentOk,
      durationMs: Date.now() - startedAt,
      bytes: Buffer.byteLength(body),
      bodyDigest: createHash("sha256").update(body).digest("hex"),
    });
  } catch (error) {
    results.push({
      ...check,
      status: 0,
      ok: false,
      durationMs: Date.now() - startedAt,
      bytes: 0,
      error: error instanceof Error ? error.message : "Route check failed.",
    });
  }
}

const report = {
  schemaVersion: "first-llm-studio.ci-route-smoke.v1",
  generatedAt: new Date().toISOString(),
  baseUrl,
  ok: results.every((result) => result.ok),
  totals: {
    checks: results.length,
    passed: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
  },
  results,
};
mkdirSync(path.dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
