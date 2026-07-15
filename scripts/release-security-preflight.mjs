#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const workspace = process.cwd();
const outputPath = path.join(
  workspace,
  "output",
  "release-security",
  "security-preflight-latest.json",
);
const historyDir = path.join(workspace, "output", "release-security", "history");
const MAX_SCAN_BYTES = 1024 * 1024;
const SECRET_RULES = [
  { id: "api-key-sk", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { id: "modelscope-token", pattern: /\bms-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi },
  { id: "aws-secret-assignment", pattern: /AWS_SECRET_ACCESS_KEY\s*[=:]\s*["']?[A-Za-z0-9/+=]{30,}/g },
  { id: "private-key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
];

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function candidateFiles() {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
    cwd: workspace,
    encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    return { files: [], error: "Unable to enumerate release candidate files with git ls-files." };
  }
  return {
    files: result.stdout.split("\0").filter(Boolean),
    error: null,
  };
}

function scanTrackedFiles() {
  const candidate = candidateFiles();
  const findings = [];
  let scannedFileCount = 0;
  let skippedFileCount = 0;
  for (const relativePath of candidate.files) {
    const filePath = path.join(workspace, relativePath);
    try {
      const stats = statSync(filePath);
      if (!stats.isFile() || stats.size > MAX_SCAN_BYTES) {
        skippedFileCount += 1;
        continue;
      }
      const buffer = readFileSync(filePath);
      if (buffer.includes(0)) {
        skippedFileCount += 1;
        continue;
      }
      const content = buffer.toString("utf8");
      scannedFileCount += 1;
      for (const rule of SECRET_RULES) {
        rule.pattern.lastIndex = 0;
        if (rule.pattern.test(content)) {
          findings.push({ file: relativePath, rule: rule.id });
        }
      }
    } catch {
      skippedFileCount += 1;
    }
  }
  const blockers = [
    ...(candidate.error ? [candidate.error] : []),
    ...(findings.length
      ? [`${findings.length} release candidate secret finding(s) require review.`]
      : []),
  ];
  return {
    status: blockers.length ? "blocked" : "pass",
    scannedFileCount,
    skippedFileCount,
    findingCount: findings.length,
    findings,
    blockers,
  };
}

function runPackageAudit() {
  const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
    cwd: workspace,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  let parsed;
  try {
    parsed = JSON.parse(result.stdout || "{}");
  } catch {
    parsed = null;
  }
  const vulnerabilities = {
    info: Number(parsed?.metadata?.vulnerabilities?.info || 0),
    low: Number(parsed?.metadata?.vulnerabilities?.low || 0),
    moderate: Number(parsed?.metadata?.vulnerabilities?.moderate || 0),
    high: Number(parsed?.metadata?.vulnerabilities?.high || 0),
    critical: Number(parsed?.metadata?.vulnerabilities?.critical || 0),
    total: Number(parsed?.metadata?.vulnerabilities?.total || 0),
  };
  const available = Boolean(parsed?.metadata?.vulnerabilities);
  const blockers = [
    ...(available ? [] : ["npm audit did not return a parseable vulnerability summary."]),
    ...(vulnerabilities.high || vulnerabilities.critical
      ? [`npm audit reports ${vulnerabilities.high} high and ${vulnerabilities.critical} critical production vulnerability(ies).`]
      : []),
  ];
  const warnings = vulnerabilities.moderate
    ? [`npm audit reports ${vulnerabilities.moderate} moderate production vulnerability(ies).`]
    : [];
  return {
    status: blockers.length
      ? (available ? "blocked" : "evidence-needed")
      : warnings.length
        ? "evidence-needed"
        : "pass",
    command: "npm audit --omit=dev --json",
    available,
    exitCode: result.status,
    vulnerabilities,
    blockers,
    warnings,
  };
}

const secretScan = scanTrackedFiles();
const packageAudit = runPackageAudit();
const blockers = [...secretScan.blockers, ...packageAudit.blockers];
const warnings = [...packageAudit.warnings];
const status = blockers.length
  ? "blocked"
  : warnings.length || packageAudit.status === "evidence-needed"
    ? "evidence-needed"
    : "pass";
const reportPayload = {
  schemaVersion: "release.security-preflight.v1",
  generatedAt: new Date().toISOString(),
  status,
  secretScan,
  packageAudit,
  blockers,
  warnings,
};
const report = {
  ...reportPayload,
  integrity: {
    algorithm: "sha256",
    digest: sha256(reportPayload),
    verified: true,
  },
};

mkdirSync(path.dirname(outputPath), { recursive: true });
mkdirSync(historyDir, { recursive: true });
const reportContent = `${JSON.stringify(report, null, 2)}\n`;
const archivePath = path.join(
  historyDir,
  `security-preflight-${report.generatedAt.replace(/[:.]/g, "-")}.json`,
);
writeFileSync(outputPath, reportContent, "utf8");
writeFileSync(archivePath, reportContent, "utf8");
console.log(`[release-security] ${status}`);
console.log(`[release-security] candidate files ${secretScan.scannedFileCount}, findings ${secretScan.findingCount}`);
console.log(`[release-security] production vulnerabilities ${packageAudit.vulnerabilities.total}`);
console.log(`[release-security] report ${path.relative(workspace, outputPath)}`);
console.log(`[release-security] archive ${path.relative(workspace, archivePath)}`);
if (status === "blocked") process.exitCode = 1;
