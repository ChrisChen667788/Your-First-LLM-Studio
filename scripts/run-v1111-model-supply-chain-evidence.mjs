#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/u, "");
const operatorToken = process.env.FIRST_LLM_OPERATOR_TOKEN || "";
const response = await fetch(`${baseUrl}/api/models/supply-chain-operations`, { method: "POST", headers: { "content-type": "application/json", ...(operatorToken ? { authorization: `Bearer ${operatorToken}` } : {}) }, body: "{}", signal: AbortSignal.timeout(30_000) });
const payload = await response.json();
if ((!response.ok && response.status !== 422) || !payload.receipt) throw new Error(payload.error || `Model supply-chain returned HTTP ${response.status}.`);
const directory = path.join(root, "output", "release-evidence");
mkdirSync(directory, { recursive: true });
const outputPath = path.join(directory, "v1.11.1-model-supply-chain.json");
writeFileSync(outputPath, `${JSON.stringify({ schemaVersion: "models.supply-chain-operations-evidence-export.v1", generatedAt: new Date().toISOString(), baseUrl, receipt: payload.receipt, evidence: payload.evidence }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ localStatus: payload.receipt.localStatus, productionStatus: payload.receipt.productionStatus, checks: payload.receipt.checks, outputPath }, null, 2));
