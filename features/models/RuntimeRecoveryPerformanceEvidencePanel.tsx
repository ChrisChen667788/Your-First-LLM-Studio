"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/layout/LocaleProvider";

type Profile = {
  id: string;
  label: string;
  targetId: string;
};

type TargetCard = {
  targetId: string;
  label: string;
};

type Evidence = {
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  performance: {
    completeReceipts: number;
    comparison: {
      status: "comparable" | "baseline-needed" | "incomplete";
      receiptIds: string[];
      blockers: string[];
    };
    receipts: Array<{
      id: string;
      generatedAt: string;
      targetLabel: string;
      resolvedModel: string;
      completionState: "complete" | "incomplete";
      comparisonKey: string;
      metrics: {
        firstTokenLatencyMs: number | null;
        tokenThroughputTps: number | null;
        memoryBytes: number | null;
        queueWaitMs: number | null;
      };
      receiptDigest: string;
    }>;
  };
  recovery: {
    restartSafe: boolean;
    observedOperations: string[];
    checkpoints: Array<{
      id: string;
      operation: string;
      targetLabel: string;
      state: "ready-to-resume" | "resumed" | "completed" | "cancelled" | "failed";
      safeBoundary: { kind: string; summary: string };
      updatedAt: string;
    }>;
  };
  blockers: string[];
  receiptPath: string;
  error?: string;
};

function statusTone(status: string) {
  return status === "pass" || status === "comparable" || status === "complete" || status === "completed"
    ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
    : "border-amber-300/25 bg-amber-300/10 text-amber-100";
}

function numberValue(value: string, multiplier = 1) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed * multiplier : null;
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function RuntimeRecoveryPerformanceEvidencePanel() {
  const { locale } = useLocale();
  const en = locale.startsWith("en");
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [targets, setTargets] = useState<TargetCard[]>([]);
  const [profileId, setProfileId] = useState("");
  const [promptClass, setPromptClass] = useState("repeatable-runtime-smoke");
  const [memoryMb, setMemoryMb] = useState("");
  const [queueWaitMs, setQueueWaitMs] = useState("");
  const [repeatedContext, setRepeatedContext] = useState(false);
  const [operation, setOperation] = useState("restart");
  const [boundaryKind, setBoundaryKind] = useState("operator-confirmed-safe-boundary");
  const [boundarySummary, setBoundarySummary] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === profileId) || null,
    [profileId, profiles],
  );
  const selectedTarget = useMemo(
    () => targets.find((target) => target.targetId === selectedProfile?.targetId) || null,
    [selectedProfile, targets],
  );

  const load = useCallback(async () => {
    setPending("load");
    setError("");
    try {
      const [evidenceResponse, operationsResponse] = await Promise.all([
        fetch("/api/models/runtime-recovery-performance", { cache: "no-store" }),
        fetch("/api/models/runtime-operations?limit=20", { cache: "no-store" }),
      ]);
      const [nextEvidence, operations] = (await Promise.all([
        evidenceResponse.json(),
        operationsResponse.json(),
      ])) as [Evidence, { operations?: { registry?: { profiles?: Profile[] }; targetCards?: TargetCard[] }; error?: string }];
      if (!evidenceResponse.ok) throw new Error(nextEvidence.error || "Runtime evidence request failed.");
      if (!operationsResponse.ok) throw new Error(operations.error || "Runtime profile request failed.");
      setEvidence(nextEvidence);
      const nextProfiles = operations.operations?.registry?.profiles || [];
      setProfiles(nextProfiles);
      setTargets(operations.operations?.targetCards || []);
      setProfileId((current) => current || nextProfiles[0]?.id || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Runtime evidence request failed.");
    } finally {
      setPending("");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function mutate(action: string, body: Record<string, unknown>, pendingKey: string) {
    setPending(pendingKey);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/models/runtime-recovery-performance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const payload = (await response.json()) as { evidence?: Evidence; error?: string };
      if (!response.ok || !payload.evidence) {
        throw new Error(payload.error || "Runtime evidence update failed.");
      }
      setEvidence(payload.evidence);
      setMessage(
        action === "capture-latest-request"
          ? (en ? "Latest request recorded without persisting prompt text." : "已记录最新请求，未持久化 prompt 原文。")
          : (en ? "Recovery checkpoint updated." : "恢复检查点已更新。"),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Runtime evidence update failed.");
    } finally {
      setPending("");
    }
  }

  function captureLatestRequest() {
    if (!profileId) {
      setError(en ? "Choose a runtime profile first." : "请先选择运行时配置。 ");
      return;
    }
    void mutate(
      "capture-latest-request",
      {
        profileId,
        promptClass,
        repeatedContext,
        memoryBytes: numberValue(memoryMb, 1024 ** 2),
        queueWaitMs: numberValue(queueWaitMs),
      },
      "capture",
    );
  }

  function createCheckpoint() {
    if (!selectedProfile || !boundarySummary.trim()) {
      setError(en ? "Choose a profile and describe the persisted boundary." : "请选择配置并描述已持久化的边界。 ");
      return;
    }
    void mutate(
      "create-checkpoint",
      {
        operation,
        targetId: selectedProfile.targetId,
        targetLabel: selectedTarget?.label || selectedProfile.targetId,
        runtimeProfileId: selectedProfile.id,
        boundaryKind,
        boundaryReference: `${selectedProfile.id}:${boundarySummary.trim()}`,
        boundarySummary,
      },
      "checkpoint",
    );
  }

  return (
    <section className="border border-cyan-300/15 bg-slate-950/55 px-5 py-5 shadow-[0_20px_70px_rgba(2,6,23,0.24)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">V1.10.2 RUNTIME EVIDENCE</p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            {en ? "Comparable performance receipts and restart-safe recovery" : "可比性能回执与可重启恢复边界"}
          </h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">
            {en
              ? "A receipt stores runtime/profile/hardware/prompt digests plus TTFT, throughput, memory, queue wait, and repeated-context state. Raw prompt text never enters this evidence store."
              : "回执保存 runtime、配置、硬件、prompt 摘要，以及 TTFT、吞吐、内存、排队等待和重复上下文状态；该证据存储不会写入 prompt 原文。"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`border px-2.5 py-1 text-xs font-semibold uppercase ${statusTone(evidence?.localStatus || "hold")}`}>
            LOCAL {pending === "load" ? "checking" : evidence?.localStatus || "hold"}
          </span>
          <span className="border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-xs font-semibold uppercase text-amber-100">
            PROD HOLD
          </span>
          <button type="button" onClick={() => void load()} disabled={pending !== ""} className="h-8 border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-300 hover:bg-white/10 disabled:opacity-50">
            {en ? "Refresh" : "刷新"}
          </button>
        </div>
      </div>

      {error ? <p className="mt-4 border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
      {message ? <p className="mt-4 border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100">{message}</p> : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Comparable", evidence?.performance.comparison.status || "--"],
          ["Complete receipts", `${evidence?.performance.completeReceipts || 0}`],
          ["Recovery ops", `${evidence?.recovery.observedOperations.length || 0}/6`],
          ["Restart", evidence?.recovery.restartSafe ? "safe" : "evidence-needed"],
          ["Production", evidence?.productionStatus || "hold"],
        ].map(([label, value]) => (
          <div key={label} className="border border-white/10 bg-white/[0.025] px-3 py-3">
            <p className="text-[10px] uppercase text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="border border-white/10 bg-black/25 p-4">
          <p className="text-sm font-semibold text-white">{en ? "Capture a complete request receipt" : "记录完整请求回执"}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {en ? "Uses the latest successful request for the selected target. Memory and queue wait must be observed at run time; leave blank to retain an incomplete, fail-closed receipt." : "使用所选 target 的最近一次成功请求。内存和排队等待应在运行时观测；留空会保存不完整且保持 HOLD 的回执。"}
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <select value={profileId} onChange={(event) => setProfileId(event.target.value)} className="border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white">
              <option value="">{en ? "Select profile" : "选择配置"}</option>
              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label} · {profile.targetId}</option>)}
            </select>
            <input value={promptClass} onChange={(event) => setPromptClass(event.target.value)} placeholder={en ? "Prompt class" : "Prompt 类别"} className="border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" />
            <input inputMode="decimal" value={memoryMb} onChange={(event) => setMemoryMb(event.target.value)} placeholder={en ? "Observed memory (MB)" : "观测内存 (MB)"} className="border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" />
            <input inputMode="decimal" value={queueWaitMs} onChange={(event) => setQueueWaitMs(event.target.value)} placeholder={en ? "Queue wait (ms)" : "排队等待 (ms)"} className="border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" />
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={repeatedContext} onChange={(event) => setRepeatedContext(event.target.checked)} />{en ? "Repeated context / warm-cache run" : "重复上下文 / 热缓存运行"}</label>
          <button type="button" onClick={captureLatestRequest} disabled={pending !== ""} className="mt-3 border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/15 disabled:opacity-50">
            {pending === "capture" ? (en ? "Capturing..." : "记录中...") : (en ? "Capture latest request" : "记录最近请求")}
          </button>
        </section>

        <section className="border border-white/10 bg-black/25 p-4">
          <p className="text-sm font-semibold text-white">{en ? "Persist a recovery boundary" : "持久化恢复边界"}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {en ? "This ledger records an operator-confirmed boundary; it does not simulate a restart. Runtime load, unload, restart, acquisition cancel/resume, and benchmark execution also append their own checkpoints." : "该台账记录经操作者确认的边界，不会模拟重启。运行时加载、卸载、重启、模型获取取消/恢复和 Benchmark 执行也会写入各自检查点。"}
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <select value={operation} onChange={(event) => setOperation(event.target.value)} className="border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white">
              {["cancel", "resume", "restart", "load", "unload", "benchmark"].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <input value={boundaryKind} onChange={(event) => setBoundaryKind(event.target.value)} placeholder={en ? "Boundary kind" : "边界类型"} className="border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" />
          </div>
          <textarea value={boundarySummary} onChange={(event) => setBoundarySummary(event.target.value)} rows={3} placeholder={en ? "What persisted state makes resumption safe?" : "什么已持久化状态使恢复安全？"} className="mt-2 w-full border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" />
          <button type="button" onClick={createCheckpoint} disabled={pending !== ""} className="mt-3 border border-violet-300/25 bg-violet-300/10 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-300/15 disabled:opacity-50">
            {pending === "checkpoint" ? (en ? "Saving..." : "保存中...") : (en ? "Persist boundary" : "持久化边界")}
          </button>
        </section>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <section className="border border-white/10 bg-black/25 p-4">
          <p className="text-sm font-semibold text-white">{en ? "Latest performance receipts" : "最新性能回执"}</p>
          <div className="mt-3 space-y-2">
            {evidence?.performance.receipts.slice(0, 4).map((receipt) => (
              <article key={receipt.id} className="border border-white/10 bg-white/[0.025] p-3 text-xs text-slate-300">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-white">{receipt.targetLabel} · {receipt.resolvedModel}</span><span className={`border px-2 py-1 uppercase ${statusTone(receipt.completionState)}`}>{receipt.completionState}</span></div>
                <p className="mt-2">TTFT {receipt.metrics.firstTokenLatencyMs ?? "--"} ms · TPS {receipt.metrics.tokenThroughputTps ?? "--"} · Memory {receipt.metrics.memoryBytes === null ? "--" : `${Math.round(receipt.metrics.memoryBytes / 1024 ** 2)} MB`} · Queue {receipt.metrics.queueWaitMs ?? "--"} ms</p>
                <p className="mt-2 break-all text-slate-500">{formatDate(receipt.generatedAt)} · {receipt.receiptDigest}</p>
              </article>
            )) || <p className="text-sm text-slate-500">{en ? "No receipts yet." : "尚无回执。"}</p>}
          </div>
        </section>

        <section className="border border-white/10 bg-black/25 p-4">
          <p className="text-sm font-semibold text-white">{en ? "Recovery checkpoints" : "恢复检查点"}</p>
          <div className="mt-3 space-y-2">
            {evidence?.recovery.checkpoints.slice(0, 4).map((checkpoint) => (
              <article key={checkpoint.id} className="border border-white/10 bg-white/[0.025] p-3 text-xs text-slate-300">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-white">{checkpoint.operation} · {checkpoint.targetLabel}</span><span className={`border px-2 py-1 uppercase ${statusTone(checkpoint.state)}`}>{checkpoint.state}</span></div>
                <p className="mt-2">{checkpoint.safeBoundary.kind} · {checkpoint.safeBoundary.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {checkpoint.state === "ready-to-resume" ? <button type="button" disabled={pending !== ""} onClick={() => void mutate("advance-checkpoint", { checkpointId: checkpoint.id, state: "resumed", reason: "Operator resumed from the persisted boundary." }, `resume:${checkpoint.id}`)} className="border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-cyan-100 disabled:opacity-50">{en ? "Resume" : "恢复"}</button> : null}
                  {checkpoint.state === "resumed" ? <button type="button" disabled={pending !== ""} onClick={() => void mutate("advance-checkpoint", { checkpointId: checkpoint.id, state: "completed", reason: "Operator confirmed recovery completion." }, `complete:${checkpoint.id}`)} className="border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-emerald-100 disabled:opacity-50">{en ? "Complete" : "完成"}</button> : null}
                  {checkpoint.state === "resumed" ? <button type="button" disabled={pending !== ""} onClick={() => void mutate("advance-checkpoint", { checkpointId: checkpoint.id, state: "failed", reason: "Operator recorded recovery failure." }, `fail:${checkpoint.id}`)} className="border border-rose-300/20 bg-rose-300/10 px-2 py-1 text-rose-100 disabled:opacity-50">{en ? "Fail" : "失败"}</button> : null}
                </div>
              </article>
            )) || <p className="text-sm text-slate-500">{en ? "No checkpoints yet." : "尚无检查点。"}</p>}
          </div>
        </section>
      </div>

      <p className="mt-4 break-all border-t border-white/10 pt-3 text-[11px] leading-5 text-amber-100">
        {evidence?.blockers.slice(0, 3).join(" ") || (en ? "Loading fail-closed evidence boundary..." : "正在加载 fail-closed 证据边界...")} · {evidence?.receiptPath || "runtime-recovery-performance.json"}
      </p>
    </section>
  );
}
