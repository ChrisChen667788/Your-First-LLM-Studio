"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  GaReleaseEvidenceBundle,
  GaReleaseEvidenceBundleHistory,
  GaReleaseEvidenceBundleVerification,
  GaReleaseEvidenceBundleStatus,
} from "./contracts";

type GaReleaseEvidenceBundlePanelProps = {
  locale: string;
};

function statusClass(status: GaReleaseEvidenceBundleStatus) {
  if (status === "pass") {
    return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  }
  if (status === "blocked") {
    return "border-rose-300/25 bg-rose-400/10 text-rose-100";
  }
  return "border-amber-300/25 bg-amber-400/10 text-amber-100";
}

export function GaReleaseEvidenceBundlePanel({
  locale,
}: GaReleaseEvidenceBundlePanelProps) {
  const en = locale.startsWith("en");
  const [bundle, setBundle] = useState<GaReleaseEvidenceBundle | null>(null);
  const [history, setHistory] = useState<GaReleaseEvidenceBundleHistory | null>(null);
  const [verification, setVerification] =
    useState<GaReleaseEvidenceBundleVerification | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadBundle = useCallback(async () => {
    const response = await fetch("/api/experiments/ga-release-evidence", {
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      bundle?: GaReleaseEvidenceBundle;
      history?: GaReleaseEvidenceBundleHistory;
      verification?: GaReleaseEvidenceBundleVerification;
      error?: string;
    };
    if (!response.ok || !payload.bundle) {
      throw new Error(payload.error || "Failed to load GA release evidence bundle.");
    }
    setBundle(payload.bundle);
    setHistory(payload.history || null);
    setVerification(payload.verification || null);
  }, []);

  useEffect(() => {
    void loadBundle().catch((loadError) => {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load GA release evidence bundle.",
      );
    });
  }, [loadBundle]);

  async function writeBundle() {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/experiments/ga-release-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "write-bundle" }),
      });
      const payload = (await response.json()) as {
        bundle?: GaReleaseEvidenceBundle;
        history?: GaReleaseEvidenceBundleHistory;
        verification?: GaReleaseEvidenceBundleVerification;
        archivePath?: string;
        error?: string;
      };
      if (!response.ok || !payload.bundle) {
        throw new Error(payload.error || "Failed to write GA release evidence bundle.");
      }
      setBundle(payload.bundle);
      setHistory(payload.history || null);
      setVerification(payload.verification || null);
      setMessage(
        en
          ? `Bundle written: ${payload.archivePath || payload.bundle.artifactPath}`
          : `证据包已写入：${payload.archivePath || payload.bundle.artifactPath}`,
      );
    } catch (writeError) {
      setError(
        writeError instanceof Error
          ? writeError.message
          : "Failed to write GA release evidence bundle.",
      );
    } finally {
      setPending(false);
    }
  }

  async function applyRetention() {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/experiments/ga-release-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply-retention",
          retention: { maxBundles: 50, maxAgeDays: 180 },
        }),
      });
      const payload = (await response.json()) as {
        bundle?: GaReleaseEvidenceBundle;
        history?: GaReleaseEvidenceBundleHistory;
        verification?: GaReleaseEvidenceBundleVerification;
        retention?: { removedCount: number };
        error?: string;
      };
      if (!response.ok || !payload.bundle || !payload.history) {
        throw new Error(payload.error || "Failed to apply bundle retention.");
      }
      setBundle(payload.bundle);
      setHistory(payload.history);
      setVerification(payload.verification || null);
      setMessage(
        en
          ? `Retention complete: ${payload.retention?.removedCount || 0} archive(s) removed.`
          : `保留策略完成：移除 ${payload.retention?.removedCount || 0} 份归档。`,
      );
    } catch (retentionError) {
      setError(
        retentionError instanceof Error
          ? retentionError.message
          : "Failed to apply bundle retention.",
      );
    } finally {
      setPending(false);
    }
  }

  async function verifyBundle() {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/experiments/ga-release-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify-bundle" }),
      });
      const payload = (await response.json()) as {
        bundle?: GaReleaseEvidenceBundle;
        history?: GaReleaseEvidenceBundleHistory;
        verification?: GaReleaseEvidenceBundleVerification;
        error?: string;
      };
      if (!payload.bundle || !payload.verification) {
        throw new Error(payload.error || "Failed to verify GA bundle.");
      }
      setBundle(payload.bundle);
      setHistory(payload.history || null);
      setVerification(payload.verification);
      setMessage(
        en
          ? `Persisted bundle: ${payload.verification.status}.`
          : `持久化证据包：${payload.verification.status}。`,
      );
      if (!response.ok) throw new Error(payload.error || "Persisted bundle integrity is invalid.");
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Failed to verify GA bundle.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">
            GA EVIDENCE BUNDLE
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            {en ? "One manifest, two readiness views" : "一份清单，两种就绪视图"}
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {en
              ? "Non-cloud closure stays visible without treating local rehearsal as production cloud sign-off."
              : "非云闭环独立可见，同时不会把本地 rehearsal 当成生产云签收。"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => void writeBundle()} className="rounded-xl border border-cyan-200/25 bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
            {pending ? (en ? "Working..." : "处理中...") : (en ? "Write evidence bundle" : "写入证据包")}
          </button>
          <button type="button" disabled={pending} onClick={() => void applyRetention()} className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100 disabled:opacity-50">
            {en ? "Retain 50 / 180d" : "保留 50 份 / 180 天"}
          </button>
          <button type="button" disabled={pending} onClick={() => void verifyBundle()} className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100 disabled:opacity-50">
            {en ? "Verify persisted" : "校验持久化包"}
          </button>
          <a href="/api/experiments/ga-release-evidence/export?format=json" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">JSON</a>
          <a href="/api/experiments/ga-release-evidence/export?format=md" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">Markdown</a>
        </div>
      </div>

      {bundle ? (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              [en ? "Non-cloud readiness" : "非云就绪", bundle.nonCloudReadiness],
              [en ? "Production readiness" : "生产就绪", bundle.productionReadiness],
            ].map(([label, readiness]) => {
              const value = readiness as GaReleaseEvidenceBundle["nonCloudReadiness"];
              return (
                <div key={label as string} className={`rounded-2xl border p-3 ${statusClass(value.status)}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{label as string}</p>
                    <span className="text-xs uppercase tracking-[0.16em]">{value.status}</span>
                  </div>
                  <p className="mt-2 text-2xl font-semibold">{value.completionPct}%</p>
                  <p className="mt-1 text-xs opacity-75">
                    {value.blockers.length} {en ? "blocker(s)" : "个阻塞"}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid gap-2 lg:grid-cols-3">
            {bundle.sources.map((source) => (
              <article key={source.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{source.label}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${statusClass(source.status)}`}>
                    {source.status}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {source.blockers[0] || (en ? "No blocker." : "暂无阻塞。")}
                </p>
                <details className="mt-3 border-t border-white/10 pt-2 text-[11px] text-slate-400">
                  <summary className="cursor-pointer text-slate-300">
                    {en ? "Integrity and metrics" : "完整性与指标"}
                  </summary>
                  <p className="mt-2 truncate font-mono text-slate-600">SHA-256 {source.digest}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(source.metrics).map(([key, value]) => (
                      <span key={key} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                        {key}: {String(value)}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 grid gap-1">
                    {source.evidence.map((evidence) => (
                      evidence.startsWith("/") ? (
                        <a key={evidence} href={evidence} className="truncate font-mono text-cyan-200 hover:text-cyan-100">{evidence}</a>
                      ) : (
                        <span key={evidence} className="truncate font-mono text-slate-600">{evidence}</span>
                      )
                    ))}
                  </div>
                </details>
              </article>
            ))}
          </div>
          {verification ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                  {en ? "Persisted drift" : "持久化漂移"}
                </p>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] ${verification.status === "in-sync" ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : verification.status === "invalid" ? "border-rose-300/20 bg-rose-400/10 text-rose-100" : "border-amber-300/20 bg-amber-400/10 text-amber-100"}`}>
                  {verification.status}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                <span>{verification.persistedIntegrityOk ? "integrity verified" : "integrity not verified"}</span>
                <span>{verification.changedSourceIds.length} changed source(s)</span>
                {verification.changedSourceIds.map((id) => (
                  <span key={id} className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 text-amber-100">{id}</span>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
            <span className={`rounded-full border px-2.5 py-1 ${bundle.integrity.verified ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "border-rose-300/20 bg-rose-400/10 text-rose-100"}`}>
              SHA-256 {bundle.integrity.verified ? "verified" : "invalid"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
              {bundle.totals.sourceCount} sources
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
              {bundle.totals.routeSmokeHistoryCount} smoke reports
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
              {bundle.totals.providerSnapshotCount} provider snapshots
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono">
              {bundle.artifactPath}
            </span>
          </div>
          {history ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                  {en ? "Bundle history" : "证据包历史"}
                </p>
                <p className="text-[11px] text-slate-500">
                  {history.verifiedCount}/{history.totalCount} verified · {history.invalidCount} invalid
                </p>
              </div>
              <div className="mt-2 grid gap-2 lg:grid-cols-3">
                {history.entries.slice(0, 3).map((entry) => (
                  <div key={entry.file} className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>{entry.generatedAt ? new Date(entry.generatedAt).toLocaleString() : "unknown"}</span>
                      <span className={entry.integrityStatus === "verified" ? "text-emerald-200" : "text-rose-200"}>{entry.integrityStatus}</span>
                    </div>
                    <p className="mt-1 truncate font-mono text-slate-600">{entry.digest || "no digest"}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-cyan-100">{message}</p> : null}
    </section>
  );
}
