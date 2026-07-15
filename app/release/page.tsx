import type { Metadata } from "next";
import Link from "next/link";
import {
  StudioIdentityBand,
  StudioSegmentedChips,
  StudioSurface,
} from "@/components/layout/StudioPageShell";
import { readPublicReleaseEvidence } from "@/features/experiments/public-release-evidence";

export const metadata: Metadata = {
  title: "Release Evidence",
  description:
    "Public release notes, demo capture evidence, and distillation artifacts for First LLM Studio.",
};

function EvidenceBadge({
  label,
  ok,
}: {
  label: string;
  ok: boolean;
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
        ok
          ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-50"
          : "border-amber-300/30 bg-amber-300/15 text-amber-50"
      }`}
    >
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

export default function ReleasePage() {
  const evidence = readPublicReleaseEvidence();
  const blockers = evidence.blockers.slice(0, 4);
  const latestFlow = evidence.demoCapture.flows[0];

  return (
    <StudioSurface accent="amber" className="flex flex-col gap-4">
      <StudioIdentityBand
        accent="amber"
        eyebrow="PUBLIC RELEASE"
        title="First LLM Studio release evidence"
        description="A public, bilingual-friendly release surface for launch notes, demo capture assets, and reproducible fine-tune distillation evidence."
        side={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/experiments"
              className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-400/20"
            >
              Evidence Matrix
            </Link>
            <Link
              href="/fine-tune"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
            >
              Fine-tune
            </Link>
          </div>
        }
      />

      <StudioSegmentedChips
        labels={[
          `Public docs ${evidence.docsRoute.ok ? "ready" : "missing"}`,
          `Demo capture ${evidence.demoCapture.verifiedFlowCount}/${evidence.demoCapture.flowCount}`,
          `Distillation ops ${evidence.distillation.completedOperationCount}`,
        ]}
      />

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[28px] border border-white/10 bg-slate-950/70 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.42)] backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">
                Gate Snapshot
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                v0.5.1 public release readiness
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                The same contract powers this page, the release evidence matrix, and route smoke. Public docs,
                screenshots, demo capture, and distillation evidence move together.
              </p>
            </div>
            <EvidenceBadge
              label={blockers.length ? "Evidence needed" : "Ready"}
              ok={!blockers.length}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Completion"
              value={`${evidence.totals.completionPct}%`}
              detail={`${evidence.totals.passingCheckCount}/${evidence.totals.checkCount} contract checks passing.`}
            />
            <StatCard
              label="Demo flows"
              value={`${evidence.demoCapture.verifiedFlowCount}/${evidence.demoCapture.flowCount}`}
              detail="High-resolution screenshots with route and command provenance."
            />
            <StatCard
              label="Distillation"
              value={`${evidence.distillation.completedOperationCount}`}
              detail="Completed operation count with dataset, report, and manifest evidence."
            />
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">Release notes</p>
              <div className="mt-3 space-y-2">
                {evidence.releaseNoteDraft.map((line) => (
                  <p key={line} className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 px-3 py-2 text-sm leading-6 text-cyan-50/85">
                    {line}
                  </p>
                ))}
              </div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-rose-200">Blockers</p>
              <div className="mt-3 space-y-2">
                {(blockers.length ? blockers : ["No blockers in the public release evidence contract."]).map((line) => (
                  <p key={line} className={`rounded-2xl border px-3 py-2 text-sm leading-6 ${
                    blockers.length
                      ? "border-rose-300/20 bg-rose-400/10 text-rose-100"
                      : "border-white/10 bg-white/[0.035] text-slate-400"
                  }`}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </article>

        <aside className="rounded-[28px] border border-white/10 bg-slate-950/70 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.38)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">
            Demo Capture
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">Repeatable screenshot evidence</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Capture recipes are tracked in a manifest so README, ModelScope, and public docs can be refreshed from the
            same source.
          </p>
          {latestFlow ? (
            <div className="mt-5 rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{latestFlow.label}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {latestFlow.route}
                  </p>
                </div>
                <EvidenceBadge label={latestFlow.ok ? "Verified" : "Needs capture"} ok={latestFlow.ok} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{latestFlow.purpose}</p>
              <p className="mt-3 break-all rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs leading-5 text-slate-300">
                {latestFlow.screenshotPath}
              </p>
            </div>
          ) : null}
          <div className="mt-5 space-y-2">
            {evidence.docsFiles.map((file) => (
              <div key={file.relativePath} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2">
                <span className="text-sm text-slate-300">{file.label}</span>
                <EvidenceBadge label={file.ok ? "ok" : "check"} ok={file.ok} />
              </div>
            ))}
          </div>
        </aside>
      </section>
    </StudioSurface>
  );
}
