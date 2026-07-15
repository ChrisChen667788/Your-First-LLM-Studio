import crypto from "crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "fs";
import path from "path";

const REPORT_PATH = path.join(
  process.cwd(),
  "output",
  "release-security",
  "security-preflight-latest.json",
);
const HISTORY_DIR = path.join(
  process.cwd(),
  "output",
  "release-security",
  "history",
);

export type ReleaseSecurityEvidenceHistory = {
  historyDir: string;
  totalCount: number;
  verifiedCount: number;
  invalidCount: number;
  missingIntegrityCount: number;
  latestAt: string | null;
  entries: Array<{
    file: string;
    generatedAt: string | null;
    status: "pass" | "evidence-needed" | "blocked" | "unknown";
    integrityStatus: "verified" | "invalid" | "missing";
    digest: string | null;
    secretFindingCount: number;
    vulnerabilityCount: number;
    sizeBytes: number;
  }>;
};

export type ReleaseSecurityEvidence = {
  schemaVersion: "experiments.release-security-evidence.v1";
  generatedAt: string;
  reportPath: string;
  reportGeneratedAt: string | null;
  status: "pass" | "evidence-needed" | "blocked";
  fresh: boolean;
  ageHours: number | null;
  secretScan: {
    scannedFileCount: number;
    findingCount: number;
    status: string;
  };
  packageAudit: {
    available: boolean;
    status: string;
    vulnerabilities: {
      info: number;
      low: number;
      moderate: number;
      high: number;
      critical: number;
      total: number;
    };
  };
  blockers: string[];
  warnings: string[];
  integrity: {
    status: "verified" | "invalid" | "missing";
    digest: string | null;
    expectedDigest: string | null;
  };
  history: ReleaseSecurityEvidenceHistory;
};

type SecurityPreflightReport = {
  schemaVersion?: string;
  generatedAt?: string;
  status?: string;
  secretScan?: {
    status?: string;
    scannedFileCount?: number;
    findingCount?: number;
  };
  packageAudit?: {
    status?: string;
    available?: boolean;
    vulnerabilities?: Partial<ReleaseSecurityEvidence["packageAudit"]["vulnerabilities"]>;
  };
  blockers?: string[];
  warnings?: string[];
  integrity?: {
    algorithm?: string;
    digest?: string;
    verified?: boolean;
  };
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function verifyReportIntegrity(
  report: SecurityPreflightReport | null,
): ReleaseSecurityEvidence["integrity"] {
  if (!report?.integrity?.digest) {
    return { status: "missing" as const, digest: null, expectedDigest: null };
  }
  const { integrity, ...payload } = report;
  const expectedDigest = crypto
    .createHash("sha256")
    .update(stableStringify(payload))
    .digest("hex");
  return {
    status: integrity.algorithm === "sha256" && integrity.digest === expectedDigest
      ? "verified" as const
      : "invalid" as const,
    digest: report.integrity.digest,
    expectedDigest,
  };
}

function readSecurityReport(filePath: string): SecurityPreflightReport | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as SecurityPreflightReport;
  } catch {
    return null;
  }
}

export function readReleaseSecurityEvidenceHistory(options?: {
  limit?: number;
}): ReleaseSecurityEvidenceHistory {
  const limit = Math.max(1, Math.min(options?.limit || 30, 200));
  const entries = existsSync(HISTORY_DIR)
    ? readdirSync(HISTORY_DIR)
        .filter((name) => name.startsWith("security-preflight-") && name.endsWith(".json"))
        .map((name) => {
          const filePath = path.join(HISTORY_DIR, name);
          const report = readSecurityReport(filePath);
          const integrity = verifyReportIntegrity(report);
          const status: ReleaseSecurityEvidenceHistory["entries"][number]["status"] =
            report?.status === "pass" ||
            report?.status === "evidence-needed" ||
            report?.status === "blocked"
            ? report.status
            : "unknown";
          return {
            file: path.relative(process.cwd(), filePath),
            generatedAt: report?.generatedAt || null,
            status,
            integrityStatus: integrity.status,
            digest: integrity.digest,
            secretFindingCount: Number(report?.secretScan?.findingCount || 0),
            vulnerabilityCount: Number(report?.packageAudit?.vulnerabilities?.total || 0),
            sizeBytes: statSync(filePath).size,
          };
        })
        .sort((left, right) =>
          (right.generatedAt || "").localeCompare(left.generatedAt || ""),
        )
    : [];
  return {
    historyDir: path.relative(process.cwd(), HISTORY_DIR),
    totalCount: entries.length,
    verifiedCount: entries.filter((entry) => entry.integrityStatus === "verified").length,
    invalidCount: entries.filter((entry) => entry.integrityStatus === "invalid").length,
    missingIntegrityCount: entries.filter((entry) => entry.integrityStatus === "missing").length,
    latestAt: entries[0]?.generatedAt || null,
    entries: entries.slice(0, limit),
  };
}

export function applyReleaseSecurityEvidenceRetention(input?: {
  maxReports?: number;
  maxAgeDays?: number;
}) {
  const policy = {
    maxReports: Math.max(5, Math.min(input?.maxReports || 50, 200)),
    maxAgeDays: Math.max(7, Math.min(input?.maxAgeDays || 180, 730)),
  };
  const before = readReleaseSecurityEvidenceHistory({ limit: 200 });
  const cutoffMs = Date.now() - policy.maxAgeDays * 86_400_000;
  const retained = new Set(
    before.entries
      .filter((entry, index) => {
        if (index === 0) return true;
        const generatedMs = entry.generatedAt
          ? new Date(entry.generatedAt).getTime()
          : Number.NaN;
        return index < policy.maxReports &&
          Number.isFinite(generatedMs) &&
          generatedMs >= cutoffMs;
      })
      .map((entry) => entry.file),
  );
  for (const entry of before.entries) {
    if (!retained.has(entry.file)) unlinkSync(path.join(process.cwd(), entry.file));
  }
  const after = readReleaseSecurityEvidenceHistory({ limit: 200 });
  return {
    appliedAt: new Date().toISOString(),
    beforeCount: before.totalCount,
    afterCount: after.totalCount,
    removedCount: before.totalCount - after.totalCount,
    protectedLatest: before.totalCount > 0,
    policy,
  };
}

export function readReleaseSecurityEvidence(options?: {
  maxAgeHours?: number;
}): ReleaseSecurityEvidence {
  const maxAgeHours = Math.max(1, Math.min(options?.maxAgeHours || 168, 720));
  let report: SecurityPreflightReport | null = null;
  if (existsSync(REPORT_PATH)) {
    try {
      report = readSecurityReport(REPORT_PATH);
    } catch {
      report = null;
    }
  }
  const stats = existsSync(REPORT_PATH) ? statSync(REPORT_PATH) : null;
  const reportGeneratedAt = report?.generatedAt ||
    (stats ? new Date(stats.mtimeMs).toISOString() : null);
  const generatedMs = reportGeneratedAt
    ? new Date(reportGeneratedAt).getTime()
    : Number.NaN;
  const ageHours = Number.isFinite(generatedMs)
    ? Math.max(0, (Date.now() - generatedMs) / 3_600_000)
    : null;
  const fresh = ageHours !== null && ageHours <= maxAgeHours;
  const schemaOk = report?.schemaVersion === "release.security-preflight.v1";
  const integrity = verifyReportIntegrity(report);
  const vulnerabilities = {
    info: Number(report?.packageAudit?.vulnerabilities?.info || 0),
    low: Number(report?.packageAudit?.vulnerabilities?.low || 0),
    moderate: Number(report?.packageAudit?.vulnerabilities?.moderate || 0),
    high: Number(report?.packageAudit?.vulnerabilities?.high || 0),
    critical: Number(report?.packageAudit?.vulnerabilities?.critical || 0),
    total: Number(report?.packageAudit?.vulnerabilities?.total || 0),
  };
  const blockers = [
    ...(report ? [] : ["Release security preflight report is missing."]),
    ...(report && !schemaOk ? ["Release security preflight schema is invalid."] : []),
    ...(report && integrity.status !== "verified"
      ? [`Release security preflight integrity is ${integrity.status}.`]
      : []),
    ...(fresh ? [] : ["Release security preflight is stale; rerun npm run preflight:release-security."]),
    ...(Array.isArray(report?.blockers) ? report.blockers : []),
  ];
  const reportStatus = report?.status;
  const status = blockers.length
    ? reportStatus === "blocked" ? "blocked" : "evidence-needed"
    : reportStatus === "pass" ? "pass" : "evidence-needed";
  return {
    schemaVersion: "experiments.release-security-evidence.v1",
    generatedAt: new Date().toISOString(),
    reportPath: path.relative(process.cwd(), REPORT_PATH),
    reportGeneratedAt,
    status,
    fresh,
    ageHours: ageHours === null ? null : Number(ageHours.toFixed(2)),
    secretScan: {
      scannedFileCount: Number(report?.secretScan?.scannedFileCount || 0),
      findingCount: Number(report?.secretScan?.findingCount || 0),
      status: report?.secretScan?.status || "missing",
    },
    packageAudit: {
      available: report?.packageAudit?.available === true,
      status: report?.packageAudit?.status || "missing",
      vulnerabilities,
    },
    blockers,
    warnings: Array.isArray(report?.warnings) ? report.warnings : [],
    integrity,
    history: readReleaseSecurityEvidenceHistory(),
  };
}
