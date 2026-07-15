"use client";

import { useCallback, useEffect, useState } from "react";
import { ProviderOpsReleaseProbeCard } from "./ProviderOpsReleaseProbeCard";
import type {
  ProviderOpsEvidenceSnapshotStoreSummary,
  ProviderOpsEvidenceSummary,
} from "./contracts";

type ProviderOpsTargetOption = {
  targetId: string;
  targetLabel: string;
  providerLabel: string;
};

type ProviderOpsEvidencePanelProps = {
  locale: string;
  initialSummary: ProviderOpsEvidenceSummary;
  targets: ProviderOpsTargetOption[];
  onRefresh?: () => void | Promise<void>;
};

type ProviderOpsEvidenceApiResponse = {
  ok?: boolean;
  error?: string;
  summary?: ProviderOpsEvidenceSummary;
  snapshots?: ProviderOpsEvidenceSnapshotStoreSummary;
  store?: ProviderOpsEvidenceSnapshotStoreSummary;
  snapshot?: {
    id: string;
    label: string;
  };
  probe?: {
    targetLabel?: string;
    stages?: Array<{ ok?: boolean }>;
  };
  retention?: {
    removedCount: number;
    protectedCount: number;
  };
  verification?: {
    repairedCount: number;
    store: ProviderOpsEvidenceSnapshotStoreSummary;
  };
};

function formatUsd(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

export function ProviderOpsEvidencePanel({
  locale,
  initialSummary,
  targets,
  onRefresh,
}: ProviderOpsEvidencePanelProps) {
  const en = locale.startsWith("en");
  const [summary, setSummary] = useState(initialSummary);
  const [snapshots, setSnapshots] =
    useState<ProviderOpsEvidenceSnapshotStoreSummary | null>(null);
  const [pendingAction, setPendingAction] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

  const loadEvidence = useCallback(async () => {
    const response = await fetch(
      "/api/admin/provider-health/evidence?windowHours=24",
      { cache: "no-store" },
    );
    const payload = (await response.json()) as ProviderOpsEvidenceApiResponse;
    if (!response.ok || !payload.summary || !payload.snapshots) {
      throw new Error(payload.error || "Failed to load Provider Ops evidence.");
    }
    setSummary(payload.summary);
    setSnapshots(payload.snapshots);
  }, []);

  useEffect(() => {
    setSummary(initialSummary);
  }, [initialSummary]);

  useEffect(() => {
    void loadEvidence().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Failed to load Provider Ops evidence.");
      setMessageTone("error");
    });
  }, [loadEvidence]);

  const runAction = useCallback(
    async (actionKey: string, body: Record<string, unknown>) => {
      setPendingAction(actionKey);
      setMessage("");
      try {
        const response = await fetch("/api/admin/provider-health/evidence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = (await response.json()) as ProviderOpsEvidenceApiResponse;
        if (payload.summary) setSummary(payload.summary);
        if (payload.snapshots) setSnapshots(payload.snapshots);
        if (payload.store) setSnapshots(payload.store);
        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error || "Provider evidence action failed.");
        }
        await loadEvidence();
        await onRefresh?.();
        setMessageTone("success");
        return payload;
      } catch (error) {
        setMessageTone("error");
        throw error;
      } finally {
        setPendingAction("");
      }
    },
    [loadEvidence, onRefresh],
  );

  async function handleProbe(targetId: string) {
    try {
      const payload = await runAction(`probe:${targetId}`, {
        action: "run-release-probe",
        targetId,
      });
      const stageCount = payload.probe?.stages?.length || 0;
      const healthyStages =
        payload.probe?.stages?.filter((stage) => stage.ok).length || 0;
      setMessage(
        en
          ? `Release probe passed for ${payload.probe?.targetLabel || targetId} (${healthyStages}/${stageCount}).`
          : `${payload.probe?.targetLabel || targetId} 发布探针通过（${healthyStages}/${stageCount}）。`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Provider release probe failed.");
    }
  }

  async function handleCaptureSnapshot() {
    try {
      const payload = await runAction("capture", {
        action: "capture-snapshot",
        label: `Provider Ops manual snapshot ${new Date().toISOString()}`,
        reason: "Captured from the Admin Provider Ops evidence panel.",
        pinned: false,
        windowHours: 24,
      });
      setMessage(
        en
          ? `Snapshot captured: ${payload.snapshot?.label || "Provider Ops evidence"}.`
          : `已保存快照：${payload.snapshot?.label || "Provider Ops 证据"}。`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Snapshot capture failed.");
    }
  }

  async function handlePin(id: string, pinned: boolean) {
    try {
      await runAction(`pin:${id}`, {
        action: "set-snapshot-pinned",
        id,
        pinned,
      });
      setMessage(
        en
          ? `Snapshot ${pinned ? "pinned" : "unpinned"}.`
          : `快照已${pinned ? "固定" : "取消固定"}。`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Snapshot update failed.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await runAction(`delete:${id}`, {
        action: "delete-snapshot",
        id,
      });
      setMessage(en ? "Snapshot deleted." : "快照已删除。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Snapshot deletion failed.");
    }
  }

  async function handleRetention() {
    try {
      const payload = await runAction("retention", {
        action: "apply-retention",
        retention: {
          maxSnapshots: 50,
          maxAgeDays: 90,
          preservePinned: true,
        },
      });
      setMessage(
        en
          ? `Retention complete: ${payload.retention?.removedCount || 0} removed, ${payload.retention?.protectedCount || 0} pinned protected.`
          : `保留策略完成：移除 ${payload.retention?.removedCount || 0} 条，保护 ${payload.retention?.protectedCount || 0} 条固定证据。`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Retention failed.");
    }
  }

  async function handleVerifyIntegrity() {
    try {
      const payload = await runAction("verify", {
        action: "verify-snapshot-integrity",
      });
      setMessage(
        en
          ? `Integrity verified: ${payload.verification?.store.integrity.verifiedCount || 0} valid; ${payload.verification?.repairedCount || 0} legacy digest(s) added.`
          : `完整性校验完成：${payload.verification?.store.integrity.verifiedCount || 0} 条有效，补签 ${payload.verification?.repairedCount || 0} 条旧快照。`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Integrity verification failed.");
    }
  }

  return (
    <div className="mt-3 grid gap-3">
      <section className="rounded-3xl border border-emerald-300/15 bg-emerald-300/10 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-200">
              {en ? "Provider Ops evidence" : "Provider Ops 证据"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {en
                ? "Remote health, release probes, and durable evidence snapshots share one feature-owned contract."
                : "远端健康、发布探针与持久证据快照现在共用一份 feature-owned contract。"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 xl:min-w-[520px]">
            {[
              [en ? "Healthy" : "健康", `${summary.totals.healthyCount}/${summary.totals.providerCount}`],
              [en ? "Chat success" : "聊天成功率", `${summary.totals.successRatePct}%`],
              [en ? "Probe" : "探针", `${summary.releaseProbe.successCount}/${summary.releaseProbe.totalCount}`],
              [en ? "Cost" : "成本", formatUsd(summary.totals.estimatedCostUsd)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-2 xl:grid-cols-2">
          {summary.releaseNoteDraft.slice(0, 4).map((line) => (
            <p key={line} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-300">
              {line}
            </p>
          ))}
        </div>
        {summary.topRisks.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.topRisks.slice(0, 4).map((risk) => (
              <span key={risk} className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[11px] text-amber-100">
                {risk}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <ProviderOpsReleaseProbeCard
        locale={locale}
        summary={summary}
        targets={targets}
        pendingTargetId={pendingAction.startsWith("probe:") ? pendingAction.slice(6) : ""}
        message={pendingAction.startsWith("probe:") ? "" : message}
        messageTone={messageTone}
        onRun={handleProbe}
      />

      <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
              {en ? "Evidence snapshots" : "证据快照"}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {en
                ? "Pin only qualifying evidence. Retention always preserves pinned snapshots."
                : "只允许固定合格证据；保留策略始终保护已固定快照。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" disabled={Boolean(pendingAction)} onClick={() => void handleCaptureSnapshot()} className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-cyan-100 disabled:opacity-50">
              {en ? "Capture snapshot" : "保存快照"}
            </button>
            <button type="button" disabled={Boolean(pendingAction)} onClick={() => void handleRetention()} className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-amber-100 disabled:opacity-50">
              {en ? "Apply retention" : "执行保留策略"}
            </button>
            <button type="button" disabled={Boolean(pendingAction)} onClick={() => void handleVerifyIntegrity()} className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-emerald-100 disabled:opacity-50">
              {en ? "Verify integrity" : "校验完整性"}
            </button>
            <a href="/api/admin/provider-health/evidence/export?format=json" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-200">JSON</a>
            <a href="/api/admin/provider-health/evidence/export?format=md" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-200">Markdown</a>
          </div>
        </div>
        {snapshots ? (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className={`rounded-full border px-2.5 py-1 ${snapshots.integrity.status === "verified" ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "border-amber-300/20 bg-amber-400/10 text-amber-100"}`}>
              SHA-256 {snapshots.integrity.status}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-400">
              {snapshots.integrity.verifiedCount} verified · {snapshots.integrity.missingCount} missing · {snapshots.integrity.invalidCount} invalid
            </span>
          </div>
        ) : null}
        <div className="mt-3 grid gap-2">
          {snapshots?.snapshots.length ? (
            snapshots.snapshots.slice(0, 8).map((snapshot) => (
              <article key={snapshot.id} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-xs">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{snapshot.label}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{new Date(snapshot.createdAt).toLocaleString()}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <span className={`rounded-full border px-2 py-0.5 ${snapshot.qualifiesAsFreshEvidence ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "border-amber-300/20 bg-amber-400/10 text-amber-100"}`}>
                        {snapshot.qualifiesAsFreshEvidence ? (en ? "qualifying" : "合格") : (en ? "non-qualifying" : "未达标")}
                      </span>
                      {snapshot.pinned ? <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-cyan-100">{en ? "pinned" : "已固定"}</span> : null}
                      <span className={`rounded-full border px-2 py-0.5 ${snapshot.integrity.status === "verified" ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : snapshot.integrity.status === "invalid" ? "border-rose-300/20 bg-rose-400/10 text-rose-100" : "border-amber-300/20 bg-amber-400/10 text-amber-100"}`}>
                        SHA-256 {snapshot.integrity.status}
                      </span>
                      <span className="text-slate-400">chat {snapshot.summary.totals.successCount}/{snapshot.summary.totals.totalRequests}</span>
                      <span className="text-slate-400">probe {snapshot.summary.releaseProbe.successCount}/{snapshot.summary.releaseProbe.totalCount}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" disabled={Boolean(pendingAction) || (!snapshot.pinned && !snapshot.qualifiesAsFreshEvidence)} onClick={() => void handlePin(snapshot.id, !snapshot.pinned)} className="rounded-lg border border-cyan-300/20 px-2.5 py-1.5 text-cyan-100 disabled:opacity-40">
                      {snapshot.pinned ? (en ? "Unpin" : "取消固定") : (en ? "Pin" : "固定")}
                    </button>
                    <button type="button" disabled={Boolean(pendingAction) || snapshot.pinned} onClick={() => void handleDelete(snapshot.id)} className="rounded-lg border border-rose-300/20 px-2.5 py-1.5 text-rose-100 disabled:opacity-40">
                      {en ? "Delete" : "删除"}
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-xs text-slate-500">
              {en ? "No Provider evidence snapshot has been captured yet." : "尚未保存 Provider 证据快照。"}
            </p>
          )}
        </div>
        {message && !pendingAction.startsWith("probe:") ? (
          <p className={`mt-2 text-xs ${messageTone === "error" ? "text-rose-200" : "text-cyan-100"}`}>{message}</p>
        ) : null}
      </section>
    </div>
  );
}
