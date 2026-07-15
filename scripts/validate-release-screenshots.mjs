#!/usr/bin/env node

import crypto from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "docs", "demo-capture-manifest.json");
const reportPath = path.join(root, "output", "release-evidence", "screenshot-integrity-latest.json");
const manifestRaw = readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(manifestRaw);
const viewport = manifest.viewport || {};
const expectedWidth = Number(viewport.width) * Number(viewport.deviceScaleFactor);
const expectedHeight = Number(viewport.height) * Number(viewport.deviceScaleFactor);
const flows = Array.isArray(manifest.flows) ? manifest.flows : [];
const issues = [];
const ids = new Set();
const paths = new Set();

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readPngDimensions(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a" || buffer.length < 24) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const entries = flows.map((flow) => {
  const id = String(flow.id || "");
  const relativePath = String(flow.screenshotPath || "");
  if (!id || ids.has(id)) issues.push(`Invalid or duplicate flow id: ${id || "<empty>"}.`);
  if (!relativePath || paths.has(relativePath)) issues.push(`Invalid or duplicate screenshot path: ${relativePath || "<empty>"}.`);
  ids.add(id);
  paths.add(relativePath);
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    issues.push(`Missing screenshot for ${id}: ${relativePath}.`);
    return { id, path: relativePath, exists: false };
  }
  const buffer = readFileSync(absolutePath);
  const dimensions = readPngDimensions(buffer);
  if (!dimensions) issues.push(`Screenshot is not a valid PNG: ${relativePath}.`);
  if (dimensions?.width !== expectedWidth) {
    issues.push(`${id} width ${dimensions?.width || 0} does not match ${expectedWidth}.`);
  }
  if (flow.fullPage === true) {
    if ((dimensions?.height || 0) < expectedHeight) {
      issues.push(`${id} full-page height is below ${expectedHeight}.`);
    }
  } else if (dimensions?.height !== expectedHeight) {
    issues.push(`${id} viewport height ${dimensions?.height || 0} does not match ${expectedHeight}.`);
  }
  if (buffer.length < 50_000) issues.push(`${id} screenshot is unexpectedly small (${buffer.length} bytes).`);
  return {
    id,
    path: relativePath,
    exists: true,
    fullPage: flow.fullPage === true,
    width: dimensions?.width || 0,
    height: dimensions?.height || 0,
    bytes: buffer.length,
    digest: sha256(buffer),
    updatedAt: new Date(statSync(absolutePath).mtimeMs).toISOString(),
  };
});

if (flows.length < 9) issues.push(`Expected at least 9 release screenshot flows; found ${flows.length}.`);
const report = {
  schemaVersion: "experiments.screenshot-integrity.v1",
  generatedAt: new Date().toISOString(),
  ok: issues.length === 0,
  manifestPath: path.relative(root, manifestPath),
  manifestDigest: sha256(Buffer.from(manifestRaw)),
  expectedViewport: {
    width: Number(viewport.width),
    height: Number(viewport.height),
    deviceScaleFactor: Number(viewport.deviceScaleFactor),
    pixelWidth: expectedWidth,
    pixelHeight: expectedHeight,
  },
  totals: {
    flowCount: flows.length,
    verifiedCount: entries.filter((entry) => entry.exists).length,
    issueCount: issues.length,
  },
  issues,
  entries,
};
mkdirSync(path.dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`[screenshots] ${report.ok ? "pass" : "fail"} · ${report.totals.verifiedCount}/${report.totals.flowCount} · ${report.totals.issueCount} issue(s)`);
console.log(`[screenshots] report ${path.relative(root, reportPath)}`);
if (!report.ok) process.exit(1);
