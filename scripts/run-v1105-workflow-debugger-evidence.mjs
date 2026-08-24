#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/u, "");
const response = await fetch(`${baseUrl}/api/workflows/debugger-closure`, {
  headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000),
});
const evidence = await response.json();
if (!response.ok || evidence?.ok !== true) throw new Error(evidence?.error || `Workflow debugger returned HTTP ${response.status}.`);
const directory = path.join(root, "output", "release-evidence");
mkdirSync(directory, { recursive: true });
const outputPath = path.join(directory, "v1.10.5-workflow-debugger.json");
writeFileSync(outputPath, `${JSON.stringify({ schemaVersion: "workflows.debugger-closure-evidence-export.v1", generatedAt: new Date().toISOString(), baseUrl, evidence }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ localStatus: evidence.localStatus, productionStatus: evidence.productionStatus, executionId: evidence.execution?.id || null, outputPath }, null, 2));
