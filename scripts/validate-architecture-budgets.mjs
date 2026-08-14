#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const budget = JSON.parse(readFileSync(path.join(root, "architecture-budgets.json"), "utf8"));
const files = budget.files.map((entry) => {
  const content = readFileSync(path.join(root, entry.path), "utf8");
  const lines = content.endsWith("\n") ? content.split("\n").length - 1 : content.split("\n").length;
  return {
    ...entry,
    lines,
    withinCeiling: lines <= entry.ceilingLines,
    targetMet: lines <= entry.targetLines,
    remainingDebtLines: Math.max(0, lines - entry.targetLines),
  };
});

const result = {
  schemaVersion: "first-llm-studio.architecture-budget-validation.v1",
  ok: files.every((entry) => entry.withinCeiling),
  targetComplete: files.every((entry) => entry.targetMet),
  totals: {
    trackedFiles: files.length,
    ceilingBreaches: files.filter((entry) => !entry.withinCeiling).length,
    targetMet: files.filter((entry) => entry.targetMet).length,
    remainingDebtLines: files.reduce((sum, entry) => sum + entry.remainingDebtLines, 0),
  },
  files,
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
