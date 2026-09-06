"use client";

import { useState } from "react";
import type { CollectionQueueJob } from "@/features/experiments/collection-view-contract";

const field = "h-9 min-w-0 rounded-[6px] border border-white/15 bg-black/20 px-3 text-xs text-slate-200";
const button = "rounded-[6px] border border-white/15 px-3 py-2 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-40";

export function EvidenceCollectionJobControls({ job, executable, busy, en, onAction }: {
  job: CollectionQueueJob; executable: boolean; busy: boolean; en: boolean;
  onAction: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [actor, setActor] = useState("");
  const [reason, setReason] = useState("");
  const canReview = job.status === "review" || (job.status === "accepted" && !job.review?.candidateDigest);
  const send = (action: string, extra: Record<string, unknown> = {}) => void onAction({
    action, jobId: job.id, expectedRevision: job.revision, ...extra,
  });
  return <details className="min-w-0 rounded-[6px] border border-white/10 bg-black/15 px-3 py-2">
    <summary className="cursor-pointer break-words text-xs text-slate-200">
      {job.sourceMilestone} · {job.subjectId} <span className="ml-2 text-cyan-200">{job.status}</span>
      <span className="mt-1 block text-[10px] text-slate-500">{job.planVersion} · rev {job.revision} · {job.attempt}/{job.maxAttempts}</span>
    </summary>
    <div className="mt-3 grid min-w-0 gap-2">
      {job.blockers.map((blocker) => <p key={blocker} className="break-words text-xs text-amber-200">{blocker}</p>)}
      {job.submission ? <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all text-[10px] text-slate-400">{JSON.stringify(job.submission.receipt, null, 2)}</pre> : null}
      {job.review ? <p className="break-words text-xs text-slate-400">{job.review.reviewerId}: {job.review.reason}</p> : null}
      {!["cancelled", "accepted"].includes(job.status) || canReview ? <>
        <input aria-label={en ? "Actor or reviewer ID" : "操作人或复核人 ID"} className={field} value={actor} onChange={(event) => setActor(event.target.value)} placeholder={canReview ? (en ? "Reviewer ID" : "复核人 ID") : (en ? "Actor ID" : "操作人 ID")} />
        <input aria-label={en ? "Decision reason" : "操作原因"} className={field} maxLength={240} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={en ? "Decision reason" : "操作原因"} />
        <div className="flex flex-wrap gap-2">
          {executable && job.status === "queued" ? <button className={button} disabled={busy || !actor.trim()} onClick={() => send("execute", { workerId: actor })}>{job.planVersion === "v4.2.5" ? (en ? "Run quality + shadow" : "执行质量与 Shadow") : (en ? "Run catalog probe" : "执行目录探测")}</button> : null}
          {["retry-wait", "failed", "rejected"].includes(job.status) && job.attempt < job.maxAttempts ? <button className={button} disabled={busy || !actor.trim()} onClick={() => send("retry", { actorId: actor })}>{en ? "Retry" : "重试"}</button> : null}
          {canReview ? <>
            <button className={button} disabled={busy || !actor.trim() || actor.trim() === job.operatorId || reason.trim().length < 4} onClick={() => send("review", { reviewerId: actor, decision: "accepted", reason })}>{en ? "Accept receipt" : "接受回执"}</button>
            {job.status === "review" ? <button className={button} disabled={busy || !actor.trim() || actor.trim() === job.operatorId || reason.trim().length < 4} onClick={() => send("review", { reviewerId: actor, decision: "rejected", reason })}>{en ? "Reject receipt" : "退回回执"}</button> : null}
          </> : null}
          {job.status !== "accepted" ? <button className={button} disabled={busy || !actor.trim() || reason.trim().length < 4} onClick={() => send("cancel", { actorId: actor, reason })}>{en ? "Cancel job" : "取消任务"}</button> : null}
        </div>
      </> : null}
    </div>
  </details>;
}
