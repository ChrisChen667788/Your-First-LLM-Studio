"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReleaseSecurityEvidence } from "./release-security-evidence";

function statusClass(status: string) {
  if (status === "pass" || status === "verified") {
    return "border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
  }
  if (status === "blocked" || status === "invalid") {
    return "border-rose-300/20 bg-rose-400/10 text-rose-100";
  }
  return "border-amber-300/20 bg-amber-400/10 text-amber-100";
}

export function ReleaseSecurityEvidencePanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [evidence, setEvidence] = useState<ReleaseSecurityEvidence | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/experiments/release-security-evidence", {
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      evidence?: ReleaseSecurityEvidence;
      error?: string;
    };
    if (!response.ok || !payload.evidence) {
      throw new Error(payload.error || "Failed to load release security evidence.");
    }
    setEvidence(payload.evidence);
  }, []);

  useEffect(() => {
    void load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Failed to load release security evidence.");
    });
  }, [load]);

  async function applyRetention() {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/experiments/release-security-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply-retention",
          retention: { maxReports: 50, maxAgeDays: 180 },
        }),
      });
      const payload = (await response.json()) as {
        evidence?: ReleaseSecurityEvidence;
        retention?: { removedCount: number };
        error?: string;
      };
      if (!response.ok || !payload.evidence) {
        throw new Error(payload.error || "Security evidence retention failed.");
      }
      setEvidence(payload.evidence);
      setMessage(
        en
          ? `Retention complete: ${payload.retention?.removedCount || 0} report(s) removed.`
          : `保留策略完成：移除 ${payload.retention?.removedCount || 0} 份报告。`,
      );
    } catch (retentionError) {
      setError(retentionError instanceof Error ? retentionError.message : "Security evidence retention failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-violet-300">RELEASE SECURITY</p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            {en ? "Candidate worktree security evidence" : "候选工作树安全证据"}
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {en
              ? "Secret-safe candidate scanning, production dependency audit, checksums, and retained history."
              : "密钥安全扫描、生产依赖审计、完整性摘要与历史保留。"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void load()} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
            {en ? "Refresh" : "刷新"}
          </button>
          <button type="button" disabled={pending} onClick={() => void applyRetention()} className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100 disabled:opacity-50">
            {en ? "Retain 50 / 180d" : "保留 50 份 / 180 天"}
          </button>
        </div>
      </div>
      {evidence ? (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {[
              [en ? "Gate" : "门槛", evidence.status],
              [en ? "Integrity" : "完整性", evidence.integrity.status],
              [en ? "Candidate files" : "候选文件", String(evidence.secretScan.scannedFileCount)],
              [en ? "Secret findings" : "密钥命中", String(evidence.secretScan.findingCount)],
              [en ? "Prod vulnerabilities" : "生产漏洞", String(evidence.packageAudit.vulnerabilities.total)],
            ].map(([label, value]) => (
              <div key={label} className={`rounded-2xl border px-3 py-2 ${statusClass(value)}`}>
                <p className="text-[10px] uppercase tracking-[0.16em] opacity-70">{label}</p>
                <p className="mt-1 truncate text-sm font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <span>{evidence.history.verifiedCount}/{evidence.history.totalCount} verified</span>
              <span>{evidence.history.invalidCount} invalid · {evidence.history.missingIntegrityCount} legacy missing</span>
            </div>
            <div className="mt-2 grid gap-2 lg:grid-cols-3">
              {evidence.history.entries.slice(0, 3).map((entry) => (
                <div key={entry.file} className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400">
                  <div className="flex items-center justify-between gap-2">
                    <span>{entry.generatedAt ? new Date(entry.generatedAt).toLocaleString() : "unknown"}</span>
                    <span className={entry.integrityStatus === "verified" ? "text-emerald-200" : "text-amber-200"}>{entry.integrityStatus}</span>
                  </div>
                  <p className="mt-1 truncate font-mono text-slate-600">{entry.digest || "no digest"}</p>
                </div>
              ))}
            </div>
          </div>
          {evidence.blockers[0] ? <p className="mt-3 text-xs text-amber-200">{evidence.blockers[0]}</p> : null}
        </>
      ) : null}
      {message ? <p className="mt-3 text-xs text-cyan-100">{message}</p> : null}
      {error ? <p className="mt-3 text-xs text-rose-200">{error}</p> : null}
    </section>
  );
}
