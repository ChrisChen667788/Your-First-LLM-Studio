import crypto from "crypto";
import { existsSync, readFileSync, statSync } from "fs";
import path from "path";

const REPORT_PATH = path.join(
  process.cwd(),
  "output",
  "release-evidence",
  "screenshot-integrity-latest.json",
);
const MANIFEST_PATH = path.join(process.cwd(), "docs", "demo-capture-manifest.json");

export function readScreenshotIntegrityEvidence() {
  const reportPath = path.relative(process.cwd(), REPORT_PATH);
  if (!existsSync(REPORT_PATH) || !existsSync(MANIFEST_PATH)) {
    return {
      status: "evidence-needed" as const,
      reportPath,
      blockers: ["Release screenshot integrity report is missing."],
      metrics: { flowCount: 0, verifiedCount: 0, issueCount: 1, manifestInSync: false },
    };
  }
  try {
    const report = JSON.parse(readFileSync(REPORT_PATH, "utf8")) as {
      ok?: boolean;
      generatedAt?: string;
      manifestDigest?: string;
      totals?: { flowCount?: number; verifiedCount?: number; issueCount?: number };
      issues?: string[];
    };
    const manifestDigest = crypto
      .createHash("sha256")
      .update(readFileSync(MANIFEST_PATH))
      .digest("hex");
    const manifestInSync = report.manifestDigest === manifestDigest;
    const ageHours = Math.max(0, (Date.now() - statSync(REPORT_PATH).mtimeMs) / 3_600_000);
    const blockers = [
      ...(report.ok ? [] : report.issues || ["Screenshot integrity validation failed."]),
      ...(manifestInSync ? [] : ["Screenshot integrity report does not match the current manifest."]),
      ...(ageHours <= 24 * 7 ? [] : ["Screenshot integrity report is older than seven days."]),
    ];
    return {
      status: blockers.length ? ("evidence-needed" as const) : ("pass" as const),
      reportPath,
      blockers,
      metrics: {
        flowCount: report.totals?.flowCount || 0,
        verifiedCount: report.totals?.verifiedCount || 0,
        issueCount: report.totals?.issueCount || 0,
        manifestInSync,
        ageHours: Number(ageHours.toFixed(2)),
      },
    };
  } catch {
    return {
      status: "evidence-needed" as const,
      reportPath,
      blockers: ["Screenshot integrity report is unreadable."],
      metrics: { flowCount: 0, verifiedCount: 0, issueCount: 1, manifestInSync: false },
    };
  }
}
