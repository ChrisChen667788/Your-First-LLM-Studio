"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ReleaseCandidateReceipt = {
  generatedAt: string;
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  artifact: {
    id: string | null;
    version: string | null;
    registryRecordId: string | null;
    checkpointSha256: string | null;
    packageSha256: string | null;
  };
  workload: {
    baseTargetId: string | null;
    adapterTargetId: string | null;
    benchmarkRunIds: string[];
    pairedSamples: number;
    pairedBatches: number;
  };
  checks: Record<string, boolean>;
  blockers: string[];
  productionBlockers: string[];
  evidenceDigest: string;
};

type ReleaseCandidatePayload = {
  ok: boolean;
  localStatus: "pass" | "evidence-needed";
  productionStatus: "hold";
  latestPassing: ReleaseCandidateReceipt | null;
  error?: string;
};

const CHECK_LABELS: Record<string, { en: string; zh: string }> = {
  checkpointExists: { en: "Checkpoint present", zh: "Checkpoint 实体存在" },
  checkpointChecksumVerified: { en: "Checkpoint checksum", zh: "Checkpoint 校验和" },
  baseRevisionPinned: { en: "Base revision pinned", zh: "Base revision 固定" },
  registryRoundTripVerified: { en: "Registry read-back", zh: "Registry 回读" },
  pairedBatchCoverage: { en: "Paired batch coverage", zh: "配对批次覆盖" },
  pairedSampleCoverage: { en: "Paired sample coverage", zh: "配对样本覆盖" },
  objectiveEvaluatorDeclared: { en: "Objective evaluator", zh: "客观评测器" },
  regressionPassed: { en: "Regression gate", zh: "回归门禁" },
  artifactBindingPassed: { en: "Artifact binding", zh: "Artifact 绑定" },
  qualityBillingClaimPassed: { en: "Quality claim", zh: "质量声明" },
  tokenAccountingReconciled: { en: "Token accounting", zh: "Token 对账" },
  currentUsageReconciliationPassed: { en: "Current usage", zh: "当前 usage 对账" },
  usageSettlementRetrySafe: { en: "Retry-safe settlement", zh: "可重试结算" },
  localAuditArchived: { en: "Local audit archive", zh: "本地审计归档" },
  localSigningReceiptVerified: { en: "Local signing receipt", zh: "本地签名 receipt" },
  oldPrimaryFenced: { en: "Old primary fenced", zh: "旧主节点 fencing" },
  standbyPromoted: { en: "Standby promoted", zh: "Standby promotion" },
  rpoRtoMeasured: { en: "RPO/RTO measured", zh: "RPO/RTO 测量" },
};

function shortDigest(value: string | null) {
  return value ? `${value.slice(0, 12)}...${value.slice(-8)}` : "--";
}

export function V151ReleaseCandidatePanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<ReleaseCandidatePayload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (run = false) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/evaluation/release-candidate", {
        method: run ? "POST" : "GET",
        cache: "no-store",
        headers: run ? { "content-type": "application/json" } : undefined,
        body: run ? "{}" : undefined,
      });
      const body = await response.json() as ReleaseCandidatePayload & {
        evidence?: ReleaseCandidatePayload;
      };
      if (!response.ok && response.status !== 422) {
        throw new Error(body.error || "Release-candidate verification failed.");
      }
      setPayload(body.evidence || body);
    } catch (caught) {
      setError(caught instanceof Error
        ? caught.message
        : "Release-candidate verification failed.");
    } finally {
      setPending(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const receipt = payload?.latestPassing || null;
  const checks = useMemo(() => Object.entries(receipt?.checks || {}), [receipt]);
  const passingChecks = checks.filter(([, passed]) => passed).length;

  return (
    <section className="border border-cyan-300/20 bg-slate-950/75 p-4 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-cyan-300">V1.5.1 RELEASE CANDIDATE</p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {en ? "Adapter quality and control-plane evidence" : "Adapter 质量与控制面证据"}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {en
              ? "One exact adapter checkpoint is tied to paired evaluation, provenance, usage reconciliation, settlement, and local failover evidence. Production acceptance remains independent."
              : "将一个明确的 adapter checkpoint 与配对评测、provenance、usage 对账、结算和本地 failover 证据绑定；生产签收继续独立判定。"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={pending}
          className="border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/20 disabled:cursor-wait disabled:opacity-60"
        >
          {pending
            ? (en ? "Verifying..." : "正在核验...")
            : (en ? "Verify evidence" : "重新核验证据")}
        </button>
      </div>

      {error ? (
        <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="min-w-0">
          <div className="grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [en ? "Local gate" : "本地门禁", receipt?.localStatus?.toUpperCase() || "--"],
              [en ? "Checks" : "检查项", `${passingChecks}/${checks.length || 18}`],
              [en ? "Paired batches" : "配对批次", String(receipt?.workload.pairedBatches || 0)],
              [en ? "Paired samples" : "配对样本", String(receipt?.workload.pairedSamples || 0)],
            ].map(([label, value]) => (
              <div key={label} className="bg-slate-950 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-semibold text-cyan-100">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {checks.length ? checks.map(([id, passed]) => (
              <article key={id} className="border border-white/10 bg-black/25 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-slate-200">
                    {CHECK_LABELS[id]?.[en ? "en" : "zh"] || id}
                  </p>
                  <span className={`text-[10px] font-semibold uppercase ${passed ? "text-emerald-200" : "text-amber-200"}`}>
                    {passed ? "PASS" : "HOLD"}
                  </span>
                </div>
              </article>
            )) : Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-9 animate-pulse border border-white/10 bg-white/[0.025]" />
            ))}
          </div>
        </div>

        <aside className="border-l border-white/10 pl-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-500">
                {en ? "Production gate" : "生产门禁"}
              </p>
              <p className="mt-1 text-base font-semibold text-amber-100">HOLD</p>
            </div>
            <span className="border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-100">
              {receipt ? "LOCAL PASS" : "EVIDENCE NEEDED"}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {(receipt?.productionBlockers || []).map((blocker) => (
              <p key={blocker} className="border-l-2 border-amber-300/35 pl-3 text-xs leading-5 text-slate-400">
                {blocker}
              </p>
            ))}
          </div>
        </aside>
      </div>

      {receipt ? (
        <div className="mt-4 grid gap-3 border-t border-white/10 pt-3 text-xs text-slate-400 md:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase text-slate-600">Artifact</p>
            <p className="mt-1 break-all text-slate-300">{receipt.artifact.id}@{receipt.artifact.version}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-600">Checkpoint SHA-256</p>
            <p className="mt-1 font-mono text-slate-300">{shortDigest(receipt.artifact.checkpointSha256)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-600">Package SHA-256</p>
            <p className="mt-1 font-mono text-slate-300">{shortDigest(receipt.artifact.packageSha256)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-600">Evidence digest</p>
            <p className="mt-1 font-mono text-slate-300">{shortDigest(receipt.evidenceDigest)}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
