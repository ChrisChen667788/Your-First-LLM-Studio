"use client";

import { useEffect, useState } from "react";
import type { AdminCompatibilitySunsetEvidence } from "@/features/admin/compatibility-sunset";
import type { AdminCompatibilityUsageSummary } from "@/features/admin/compatibility-usage";
import type { AdminCompatibilityDeletionManifest } from "@/features/admin/compatibility-deletion-manifest";
import type { AdminCompatibilityDeletionSignoffSummary } from "@/features/admin/compatibility-deletion-signoff";

type AdminCompatibilitySunsetPanelProps = {
  locale: string;
  usage?: AdminCompatibilityUsageSummary;
  sunset?: AdminCompatibilitySunsetEvidence;
  deletionManifest?: AdminCompatibilityDeletionManifest;
  archivePending?: boolean;
  archiveMessage?: string;
  onArchiveHistoricalUsage?: () => void | Promise<void>;
};

export function AdminCompatibilitySunsetPanel({
  locale,
  usage,
  sunset,
  deletionManifest,
  archivePending = false,
  archiveMessage = "",
  onArchiveHistoricalUsage,
}: AdminCompatibilitySunsetPanelProps) {
  const en = locale.startsWith("en");
  const runtimeHits =
    sunset?.totals.runtimeHitCount ??
    usage?.routes.reduce(
      (sum, route) => sum + (route.runtimeHitCount ?? route.hitCount),
      0,
    ) ??
    0;
  const smokeHits =
    sunset?.totals.smokeHitCount ??
    usage?.routes.reduce((sum, route) => sum + (route.smokeHitCount ?? 0), 0) ??
    0;
  const legacyUnclassifiedHits =
    sunset?.totals.legacyUnclassifiedHitCount ??
    usage?.legacyUnclassifiedHits ??
    0;
  const coverageLabel = sunset
    ? `${sunset.totals.coveredSmokeRouteCount}/${sunset.totals.requiredSmokeRouteCount}`
    : "--";
  const canArchiveHistorical =
    legacyUnclassifiedHits > 0 && runtimeHits === 0 && Boolean(onArchiveHistoricalUsage);
  const [signoffs, setSignoffs] =
    useState<AdminCompatibilityDeletionSignoffSummary | null>(null);
  const [operatorId, setOperatorId] = useState("");
  const [signoffReason, setSignoffReason] = useState("");
  const [signoffPending, setSignoffPending] = useState(false);
  const [signoffMessage, setSignoffMessage] = useState("");
  const canSignOff =
    deletionManifest?.status === "ready" &&
    operatorId.trim().length >= 3 &&
    signoffReason.trim().length >= 12;

  useEffect(() => {
    void fetch("/api/admin/compatibility-usage", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          deletionSignoffs?: AdminCompatibilityDeletionSignoffSummary;
        };
        if (response.ok && payload.deletionSignoffs) {
          setSignoffs(payload.deletionSignoffs);
        }
      })
      .catch(() => undefined);
  }, [deletionManifest?.generatedAt]);

  async function handleSignOff() {
    setSignoffPending(true);
    setSignoffMessage("");
    try {
      const response = await fetch("/api/admin/compatibility-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sign-off-deletion",
          operatorId,
          reason: signoffReason,
        }),
      });
      const payload = (await response.json()) as {
        summary?: AdminCompatibilityDeletionSignoffSummary;
        error?: string;
      };
      if (!response.ok || !payload.summary) {
        throw new Error(payload.error || "Compatibility deletion sign-off failed.");
      }
      setSignoffs(payload.summary);
      setSignoffReason("");
      setSignoffMessage(en ? "Deletion manifest signed." : "删除 manifest 已签收。");
    } catch (error) {
      setSignoffMessage(error instanceof Error ? error.message : "Compatibility deletion sign-off failed.");
    } finally {
      setSignoffPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-slate-300">
            {en ? "Admin compatibility sunset evidence" : "Admin 兼容层 sunset 证据"}
          </p>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            {en
              ? "Separate route-smoke proof from real legacy traffic before the 2026-09-30 wrapper sunset."
              : "在 2026-09-30 wrapper sunset 前，把 route-smoke 证明和真实遗留流量分开统计。"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-100">
            {en ? "runtime" : "真实"} {runtimeHits}
          </span>
          <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-emerald-100">
            smoke {smokeHits}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">
            legacy {legacyUnclassifiedHits}
          </span>
          <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-2.5 py-1 text-violet-100">
            headers {coverageLabel}
          </span>
          <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-amber-100">
            {sunset?.deletionReadiness || "scheduled"}
          </span>
          {deletionManifest ? (
            <span className="rounded-full border border-rose-300/20 bg-rose-400/10 px-2.5 py-1 text-rose-100">
              delete {deletionManifest.totals.deleteReadyCount}/
              {deletionManifest.totals.wrapperFileCount}
            </span>
          ) : null}
          {deletionManifest ? (
            <span className={`rounded-full border px-2.5 py-1 ${deletionManifest.preSunsetStatus === "ready" ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "border-amber-300/20 bg-amber-300/10 text-amber-100"}`}>
              rehearsal {deletionManifest.totals.preSunsetReadyCount}/
              {deletionManifest.totals.wrapperFileCount}
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="text-[11px] leading-5 text-slate-500">
          {sunset?.historicalArchives.archiveCount ? (
            <span>
              {en ? "Archive" : "归档"}{" "}
              {sunset.historicalArchives.archiveCount} ·{" "}
              {sunset.historicalArchives.archivedLegacyUnclassifiedHits}{" "}
              {en ? "historical hits" : "条历史命中"}
              {sunset.historicalArchives.latestArchiveAt
                ? ` · ${new Date(sunset.historicalArchives.latestArchiveAt).toLocaleString()}`
                : ""}
            </span>
          ) : (
            <span>
              {en
                ? "No historical compatibility archive has been written yet."
                : "还没有写入历史兼容命中归档。"}
            </span>
          )}
          {archiveMessage ? (
            <span className="ml-2 text-cyan-100">{archiveMessage}</span>
          ) : null}
        </div>
        <button
          type="button"
          disabled={!canArchiveHistorical || archivePending}
          onClick={() => void onArchiveHistoricalUsage?.()}
          className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition enabled:hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {archivePending
            ? en
              ? "Archiving..."
              : "归档中..."
            : en
              ? "Archive & clear historical"
              : "归档并清理历史命中"}
        </button>
      </div>
      {sunset ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-[11px] leading-5 text-slate-400">
          <span>
            sunset {sunset.sunsetAt.slice(0, 10)} ·{" "}
            {sunset.daysUntilSunset > 0
              ? `${sunset.daysUntilSunset} ${en ? "days remaining" : "天后到期"}`
              : en
                ? "sunset elapsed"
                : "sunset 已到期"}
          </span>
          {sunset.blockers.length ? (
            <span className="ml-2 text-amber-100">
              {sunset.blockers.length} {en ? "blocker(s)" : "个阻塞"}
            </span>
          ) : (
            <span className="ml-2 text-emerald-100">
              {en ? "ready for deletion evidence archive" : "已可归档删除证据"}
            </span>
          )}
        </div>
      ) : null}
      <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-200">
              {en ? "Operator deletion sign-off" : "Operator 删除签收"}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              {deletionManifest?.status === "ready"
                ? (en ? "Bind a trusted operator identity to the current manifest digest." : "将可信 operator 身份绑定到当前 manifest 摘要。")
                : (en ? "Sign-off unlocks only after the deletion manifest becomes ready." : "只有删除 manifest 就绪后才允许签收。")}
            </p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] ${signoffs?.currentCount ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "border-amber-300/20 bg-amber-400/10 text-amber-100"}`}>
            {signoffs?.currentCount || 0} current · {signoffs?.staleCount || 0} stale
          </span>
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_auto]">
          <input value={operatorId} onChange={(event) => setOperatorId(event.target.value)} placeholder={en ? "operator identity" : "operator 身份"} disabled={deletionManifest?.status !== "ready"} className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-600 disabled:opacity-45" />
          <input value={signoffReason} onChange={(event) => setSignoffReason(event.target.value)} placeholder={en ? "sign-off reason (12+ characters)" : "签收原因（至少 12 个字符）"} disabled={deletionManifest?.status !== "ready"} className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-600 disabled:opacity-45" />
          <button type="button" disabled={!canSignOff || signoffPending} onClick={() => void handleSignOff()} className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-45">
            {signoffPending ? (en ? "Signing..." : "签收中...") : (en ? "Sign manifest" : "签收 manifest")}
          </button>
        </div>
        {signoffMessage ? <p className="mt-2 text-[11px] text-cyan-100">{signoffMessage}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <a href="/api/admin/compatibility-usage/rehearsal/export?format=json" className="rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-100">Rehearsal JSON</a>
          <a href="/api/admin/compatibility-usage/rehearsal/export?format=md" className="rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-100">Rehearsal Markdown</a>
          <a href="/api/admin/compatibility-usage/signoffs/export?format=json" className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">JSON</a>
          <a href="/api/admin/compatibility-usage/signoffs/export?format=md" className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">Markdown</a>
        </div>
        {signoffs?.signoffs[0] ? (
          <p className="mt-2 truncate font-mono text-[10px] text-slate-600">
            {signoffs.signoffs[0].operatorId} · {signoffs.signoffs[0].manifestDigest}
          </p>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2">
        {sunset?.routes.length ? (
          sunset.routes.map((route) => {
            const deletion = deletionManifest?.routes.find(
              (entry) => entry.legacyPath === route.legacyPath,
            );
            return (
              <article
              key={`admin-compat-sunset:${route.legacyPath}`}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-xs text-slate-400"
            >
              <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300">
                      {route.methods.join("/")}
                    </span>
                    <span className="font-mono text-slate-200">
                      {route.legacyPath}
                    </span>
                  </div>
                  <p className="mt-2 truncate font-mono text-slate-500">
                    {en ? "Successor" : "替代路径"}: {route.canonicalPath}
                  </p>
                  {deletion ? (
                    <p className="mt-1 truncate font-mono text-[11px] text-slate-600">
                      {deletion.wrapperFile} → {deletion.canonicalFile}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 ${
                      route.headerSmokeCovered
                        ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                        : "border-amber-300/20 bg-amber-300/10 text-amber-100"
                    }`}
                  >
                    smoke {route.smokeCoveredMethods.length}/
                    {route.smokeMethods.length || 0}
                  </span>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-100">
                    runtime {route.runtimeHitCount}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-400">
                    legacy {route.legacyUnclassifiedHitCount}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-400">
                    {route.latestSeenAt
                      ? new Date(route.latestSeenAt).toLocaleString()
                      : en
                        ? "not seen"
                        : "未命中"}
                  </span>
                  {deletion ? (
                    <span
                      className={`rounded-full border px-2.5 py-1 ${
                        deletion.decision === "delete-ready"
                          ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                          : deletion.decision === "already-removed"
                            ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
                            : "border-amber-300/20 bg-amber-300/10 text-amber-100"
                      }`}
                    >
                      {deletion.decision}
                    </span>
                  ) : null}
                </div>
              </div>
              {deletion?.blockers.length ? (
                <p className="mt-2 text-[11px] leading-5 text-amber-100">
                  {deletion.blockers.join(" · ")}
                </p>
              ) : null}
            </article>
            );
          })
        ) : usage?.routes.length ? (
          usage.routes.slice(0, 5).map((route) => (
            <article
              key={`admin-compat:${route.key}`}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-xs text-slate-400"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-slate-200">
                  {route.method} {route.legacyPath}
                </span>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-100">
                  {route.hitCount} hit{route.hitCount === 1 ? "" : "s"}
                </span>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-3 text-xs leading-6 text-emerald-100">
            {en
              ? "No deprecated Admin compatibility route usage has been recorded."
              : "尚未记录到旧 Admin 兼容 API 调用。"}
          </p>
        )}
      </div>
    </div>
  );
}
