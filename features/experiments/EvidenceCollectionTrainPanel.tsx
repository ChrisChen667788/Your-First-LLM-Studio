"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collectionViewSchema, type CollectionView } from "@/features/experiments/collection-view-contract";
import { EvidenceCollectionJobControls } from "@/features/experiments/EvidenceCollectionJobControls";

export function EvidenceCollectionTrainPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<CollectionView | null>(null);
  const operatorToken = useRef("");
  const queueRequestKey = useRef<{ binding: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [planVersion, setPlanVersion] = useState("");
  const [sourceMilestone, setSourceMilestone] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [operatorId, setOperatorId] = useState("");

  const collectors = useMemo(
    () => (payload?.versions || []).filter((version) => version.kind === "collector"),
    [payload],
  );
  const selectedPlan = collectors.find((plan) => plan.version === planVersion) || collectors[0];

  const request = useCallback(async (body?: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/experiments/evidence-collection-train", body ? {
        method: "POST",
        headers: { "content-type": "application/json", ...(operatorToken.current ? { authorization: `Bearer ${operatorToken.current}` } : {}) },
        body: JSON.stringify(body),
      } : { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        const refreshed = await fetch("/api/experiments/evidence-collection-train", { cache: "no-store" });
        if (refreshed.ok) {
          const snapshot = collectionViewSchema.safeParse(await refreshed.json());
          if (snapshot.success) setPayload(snapshot.data);
        }
        throw new Error(data.error || "Unable to load evidence collection.");
      }
      const parsed = collectionViewSchema.safeParse(data.evidence || data);
      if (!parsed.success) throw new Error("Evidence response contract is invalid. Refresh after the server is updated.");
      setPayload(parsed.data);
      if (body?.action === "queue") queueRequestKey.current = null;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void request(); }, [request]);
  useEffect(() => {
    if (!planVersion && collectors[0]) setPlanVersion(collectors[0].version);
  }, [collectors, planVersion]);
  useEffect(() => {
    if (selectedPlan && !selectedPlan.sourceMilestones.includes(sourceMilestone)) {
      setSourceMilestone(selectedPlan.sourceMilestones[0] || "");
    }
  }, [selectedPlan, sourceMilestone]);

  const queue = () => {
    if (!selectedPlan || !sourceMilestone) return;
    const binding = JSON.stringify([selectedPlan.version, sourceMilestone, subjectId, organizationId, operatorId]);
    if (queueRequestKey.current?.binding !== binding) queueRequestKey.current = { binding, key: crypto.randomUUID() };
    void request({
      action: "queue",
      planVersion: selectedPlan.version,
      sourceMilestone,
      subjectId,
      organizationId,
      operatorId,
      idempotencyKey: queueRequestKey.current.key,
    });
  };

  const exportBundle = () => {
    if (!payload) return;
    const blob = new Blob([`${JSON.stringify(payload.promotionBundle, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "v4.2.0-v4.3.4-evidence-collection-promotion-bundle.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section id="evidence-collection" className="scroll-mt-24 overflow-hidden rounded-[8px] border border-emerald-300/15 bg-[#050b18]/90 shadow-[0_18px_70px_rgba(0,0,0,0.32)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">V4.2.0-V4.3.4 COLLECTION CONTROL</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">{en ? "Evidence collection queue" : "证据采集任务队列"}</h2>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-400">
            {en ? "Provider catalog: executable. Nine domain collectors: planned. Independent identity assurance: pending." : "Provider 目录可执行 · 9 个领域采集器待开发 · 独立身份认证待接入"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void request()} disabled={busy} className="rounded-[6px] border border-white/10 px-3 py-2 text-xs text-slate-200 disabled:opacity-40">{en ? "Refresh" : "刷新"}</button>
          <button type="button" onClick={exportBundle} disabled={!payload} className="rounded-[6px] border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-40">{en ? "Export bundle" : "导出晋级包"}</button>
          <button type="button" onClick={() => void request({ action: "record-train" })} disabled={busy} className="rounded-[6px] border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-300/15 disabled:opacity-40">{busy ? (en ? "Working..." : "处理中...") : (en ? "Record gate" : "记录门禁")}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-white/10 sm:grid-cols-6">
        {[
          ["SOURCE", payload ? `${payload.totals.sourcePassed}/${payload.totals.versions}` : "--", "text-emerald-300"],
          ["LOCAL", payload ? `${payload.totals.localPassed}/${payload.totals.versions}` : "--", "text-amber-200"],
          ["JOBS", payload ? String(payload.totals.jobs) : "--", "text-cyan-200"],
          ["REVIEW", payload ? String(payload.totals.reviewJobs) : "--", "text-violet-200"],
          ["ACCEPTED", payload ? String(payload.totals.acceptedJobs) : "--", "text-emerald-200"],
          ["PRODUCTION", "BLOCKED", "text-rose-300"],
        ].map(([label, value, color]) => <div key={label} className="border-r border-white/10 px-4 py-3 last:border-r-0"><p className="text-[9px] uppercase tracking-[0.15em] text-slate-500">{label}</p><p className={`mt-1 text-sm font-semibold ${color}`}>{value}</p></div>)}
      </div>

      {error ? <p className="border-b border-rose-300/15 bg-rose-400/10 px-5 py-3 text-xs text-rose-200">{error}</p> : null}
      <label className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-2 text-xs text-slate-400">{en ? "Operator token (when required)" : "Operator token（已启用认证时填写）"}<input type="password" autoComplete="off" onChange={(event) => { operatorToken.current = event.target.value; }} className="h-8 min-w-0 rounded-[6px] border border-white/10 bg-black/20 px-3" /></label>

      <div className="grid gap-3 border-b border-white/10 p-4 lg:grid-cols-[1.2fr_0.8fr_1fr_1fr_auto]">
        <label className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{en ? "Collector" : "采集器"}<select value={selectedPlan?.version || ""} onChange={(event) => setPlanVersion(event.target.value)} className="mt-2 h-10 w-full rounded-[6px] border border-white/10 bg-[#070d1c] px-3 text-xs normal-case text-slate-200"><option value="" disabled>{en ? "Select" : "请选择"}</option>{collectors.map((plan) => <option key={plan.version} value={plan.version}>{plan.version} · {plan.label}</option>)}</select></label>
        <label className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{en ? "Milestone" : "源里程碑"}<select value={sourceMilestone} onChange={(event) => setSourceMilestone(event.target.value)} className="mt-2 h-10 w-full rounded-[6px] border border-white/10 bg-[#070d1c] px-3 text-xs normal-case text-slate-200">{(selectedPlan?.sourceMilestones || []).map((version) => <option key={version}>{version}</option>)}</select></label>
        <label className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{en ? "Subject" : "任务主体"}<input value={subjectId} onChange={(event) => setSubjectId(event.target.value)} placeholder="provider-account-001" className="mt-2 h-10 w-full rounded-[6px] border border-white/10 bg-[#070d1c] px-3 text-xs normal-case text-slate-200 outline-none focus:border-emerald-300/30" /></label>
        <div className="grid grid-cols-2 gap-2"><label className="text-[10px] uppercase tracking-[0.12em] text-slate-500">ORG<input value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} placeholder="studio-org" className="mt-2 h-10 w-full rounded-[6px] border border-white/10 bg-[#070d1c] px-3 text-xs normal-case text-slate-200 outline-none focus:border-emerald-300/30" /></label><label className="text-[10px] uppercase tracking-[0.12em] text-slate-500">OPERATOR<input value={operatorId} onChange={(event) => setOperatorId(event.target.value)} placeholder="operator-001" className="mt-2 h-10 w-full rounded-[6px] border border-white/10 bg-[#070d1c] px-3 text-xs normal-case text-slate-200 outline-none focus:border-emerald-300/30" /></label></div>
        <button type="button" onClick={queue} disabled={busy || !subjectId || !organizationId || !operatorId || !selectedPlan} className="mt-[26px] h-10 rounded-[6px] bg-emerald-300 px-4 text-xs font-bold text-[#03110d] hover:bg-emerald-200 disabled:opacity-40">{en ? "Queue" : "加入队列"}</button>
      </div>

      <div className="grid gap-px bg-white/10 md:grid-cols-2 xl:grid-cols-3">
        {(payload?.versions || []).map((version) => <article key={version.version} className="min-h-[142px] bg-[#070d1c] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] uppercase tracking-[0.14em] text-emerald-300">{version.version} · {version.kind}</p><h3 className="mt-1 text-sm font-semibold text-slate-100">{version.label}</h3></div><span className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase ${version.localStatus === "pass" ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-amber-300/25 bg-amber-300/10 text-amber-200"}`}>{version.localStatus}</span></div><p className="mt-3 text-[10px] leading-4 text-slate-500">{version.sourceMilestones.length ? version.sourceMilestones.join(" · ") : version.mode}</p><div className="mt-4 flex flex-wrap gap-2 text-[9px] uppercase tracking-[0.1em] text-slate-500"><span>{version.jobTotals.active} active</span><span>{version.jobTotals.review} review</span><span>{version.jobTotals.accepted} accepted</span></div>{version.blockers[0] ? <p className="mt-2 text-[10px] leading-4 text-amber-100/60">{version.blockers[0]}</p> : null}</article>)}
      </div>

      {(payload?.queue.jobs.length || 0) > 0 ? <div className="border-t border-white/10 p-4"><p className="mb-3 text-xs text-slate-400">{en ? "Jobs" : "采集任务"}</p><div className="grid max-h-[640px] gap-2 overflow-y-auto md:grid-cols-2">{payload!.queue.jobs.map((job) => <EvidenceCollectionJobControls key={job.id} job={job} executable={payload!.versions.some((plan) => plan.version === job.planVersion && plan.executionStatus === "implemented")} busy={busy} en={en} onAction={request} />)}</div></div> : null}
      {payload ? <p className="break-all border-t border-white/10 px-5 py-3 font-mono text-[10px] text-slate-600">SHA-256 {payload.stateDigest}</p> : null}
    </section>
  );
}
