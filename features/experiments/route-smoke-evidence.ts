import crypto from "crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import path from "path";

const ROUTE_SMOKE_SCHEMA_VERSION = "first-llm-studio.route-smoke.v1" as const;
const ROUTE_SMOKE_REPORT_PATH = path.join(
  process.cwd(),
  "output",
  "release-smoke",
  "route-smoke-latest.json",
);
const ROUTE_SMOKE_HISTORY_DIR = path.join(
  process.cwd(),
  "output",
  "release-smoke",
  "history",
);

type RouteSmokeReport = {
  schemaVersion?: string;
  generatedAt?: string;
  status?: string;
  totals?: {
    checkCount?: number;
    passCount?: number;
    failureCount?: number;
    uiRouteCount?: number;
    uiRoutePassCount?: number;
    apiContractCount?: number;
    apiContractPassCount?: number;
    compatibilityHeaderCount?: number;
    compatibilityHeaderPassCount?: number;
  };
  checks?: Array<{
    kind?: string;
    label?: string;
    status?: string;
    detail?: string;
  }>;
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

function verifyReportIntegrity(report: RouteSmokeReport | null) {
  if (!report?.integrity?.digest) {
    return { status: "missing" as const, digest: null };
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
    digest: integrity.digest,
  };
}

function readReport(filePath = ROUTE_SMOKE_REPORT_PATH): RouteSmokeReport | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as RouteSmokeReport;
  } catch {
    return null;
  }
}

function readHistory() {
  const entries = existsSync(ROUTE_SMOKE_HISTORY_DIR)
    ? readdirSync(ROUTE_SMOKE_HISTORY_DIR)
        .filter((name) => name.startsWith("route-smoke-") && name.endsWith(".json"))
        .map((name) => {
          const filePath = path.join(ROUTE_SMOKE_HISTORY_DIR, name);
          const report = readReport(filePath);
          const integrity = verifyReportIntegrity(report);
          return report
            ? {
                file: path.relative(process.cwd(), filePath),
                generatedAt: report.generatedAt || null,
                status: report.status === "pass" ? ("pass" as const) : ("fail" as const),
                checkCount: report.totals?.checkCount || 0,
                failureCount: report.totals?.failureCount || 0,
                integrityStatus: integrity.status,
                digest: integrity.digest,
              }
            : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort((left, right) =>
          (right.generatedAt || "").localeCompare(left.generatedAt || ""),
        )
    : [];
  let consecutivePassCount = 0;
  for (const entry of entries) {
    if (entry.status !== "pass") break;
    consecutivePassCount += 1;
  }
  return {
    historyDir: path.relative(process.cwd(), ROUTE_SMOKE_HISTORY_DIR),
    reportCount: entries.length,
    passCount: entries.filter((entry) => entry.status === "pass").length,
    failCount: entries.filter((entry) => entry.status === "fail").length,
    consecutivePassCount,
    latestFailureAt:
      entries.find((entry) => entry.status === "fail")?.generatedAt || null,
    verifiedCount: entries.filter((entry) => entry.integrityStatus === "verified").length,
    invalidCount: entries.filter((entry) => entry.integrityStatus === "invalid").length,
    missingIntegrityCount: entries.filter((entry) => entry.integrityStatus === "missing").length,
    reports: entries.slice(0, 20),
  };
}

export function readRouteSmokeEvidence() {
  const exists = existsSync(ROUTE_SMOKE_REPORT_PATH);
  const report = exists ? readReport() : null;
  const stats = exists ? statSync(ROUTE_SMOKE_REPORT_PATH) : null;
  const schemaOk = report?.schemaVersion === ROUTE_SMOKE_SCHEMA_VERSION;
  const integrity = verifyReportIntegrity(report);
  const totals = {
    checkCount: report?.totals?.checkCount || 0,
    passCount: report?.totals?.passCount || 0,
    failureCount: report?.totals?.failureCount || 0,
    uiRouteCount: report?.totals?.uiRouteCount || 0,
    uiRoutePassCount: report?.totals?.uiRoutePassCount || 0,
    apiContractCount: report?.totals?.apiContractCount || 0,
    apiContractPassCount: report?.totals?.apiContractPassCount || 0,
    compatibilityHeaderCount: report?.totals?.compatibilityHeaderCount || 0,
    compatibilityHeaderPassCount:
      report?.totals?.compatibilityHeaderPassCount || 0,
  };
  const ok =
    exists &&
    schemaOk &&
    integrity.status === "verified" &&
    report?.status === "pass" &&
    totals.failureCount === 0 &&
    totals.uiRouteCount >= 9 &&
    totals.uiRoutePassCount === totals.uiRouteCount &&
    totals.apiContractCount >= 20 &&
    totals.apiContractPassCount === totals.apiContractCount &&
    totals.compatibilityHeaderCount >= 4 &&
    totals.compatibilityHeaderPassCount === totals.compatibilityHeaderCount;
  const blockers = [
    ...(exists ? [] : ["Route smoke report is missing; run npm run smoke:routes."]),
    ...(exists && !schemaOk
      ? ["Route smoke report schema is invalid or stale."]
      : []),
    ...(exists && integrity.status !== "verified"
      ? [`Route smoke report integrity is ${integrity.status}.`]
      : []),
    ...(totals.failureCount === 0
      ? []
      : [`Route smoke report includes ${totals.failureCount} failure(s).`]),
    ...(totals.uiRouteCount >= 9 &&
    totals.uiRoutePassCount === totals.uiRouteCount
      ? []
      : ["Route smoke did not cover every foreground/governance UI route."]),
    ...(totals.apiContractCount >= 20 &&
    totals.apiContractPassCount === totals.apiContractCount
      ? []
      : ["Route smoke API contract coverage is incomplete."]),
    ...(totals.compatibilityHeaderCount >= 4 &&
    totals.compatibilityHeaderPassCount === totals.compatibilityHeaderCount
      ? []
      : ["Route smoke compatibility header coverage is incomplete."]),
  ];
  const history = readHistory();

  return {
    schemaVersion: "experiments.route-smoke-evidence.v1" as const,
    generatedAt: new Date().toISOString(),
    reportPath: path.relative(process.cwd(), ROUTE_SMOKE_REPORT_PATH),
    exists,
    updatedAt: stats ? new Date(stats.mtimeMs).toISOString() : null,
    ok,
    totals,
    integrity,
    failures: (report?.checks || [])
      .filter((check) => check.status !== "pass")
      .map((check) => ({
        kind: check.kind || "unknown",
        label: check.label || "Unnamed check",
        detail: check.detail || "No failure detail.",
      })),
    history,
    blockers,
  };
}

export function serializeRouteSmokeEvidenceAsMarkdown() {
  const evidence = readRouteSmokeEvidence();
  return [
    "# Route Smoke Evidence",
    "",
    `Generated: ${evidence.generatedAt}`,
    `Status: ${evidence.ok ? "pass" : "fail"}`,
    `Integrity: ${evidence.integrity.status}`,
    `Checks: ${evidence.totals.passCount}/${evidence.totals.checkCount}`,
    `History: ${evidence.history.passCount}/${evidence.history.reportCount} pass`,
    `Consecutive passes: ${evidence.history.consecutivePassCount}`,
    "",
    "## Failures",
    "",
    ...(evidence.failures.length
      ? evidence.failures.map((failure) => `- ${failure.kind} · ${failure.label}: ${failure.detail}`)
      : ["- none"]),
    "",
  ].join("\n");
}
