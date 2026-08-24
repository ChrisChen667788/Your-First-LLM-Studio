#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/u, "");
const execution = process.env.FIRST_LLM_EVIDENCE_EXECUTION === "remote" ? "remote" : "local";
const response = await fetch(
  `${baseUrl}/api/governance/workspace-provenance?execution=${execution}`,
  {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  },
);
const provenance = await response.json();

if (!response.ok || provenance?.ok !== true) {
  throw new Error(provenance?.error?.message || `Workspace provenance returned HTTP ${response.status}.`);
}

const directory = path.join(root, "output", "release-evidence");
mkdirSync(directory, { recursive: true });
const outputPath = path.join(directory, "v1.10.3-workspace-provenance.json");
writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: "governance.workspace-action-provenance-evidence-export.v1",
      generatedAt: new Date().toISOString(),
      baseUrl,
      provenance,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
console.log(
  JSON.stringify(
    {
      authMode: provenance.context.authMode,
      executionLocality: provenance.action.executionLocality,
      dataBoundary: provenance.action.dataBoundary,
      contextDigest: provenance.audit.contextDigest,
      outputPath,
    },
    null,
    2,
  ),
);
