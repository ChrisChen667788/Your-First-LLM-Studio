import type {
  AgentBenchmarkResponse,
  AgentCompareResponse,
} from "@/lib/agent/types";

type CompareRunHandoffPanelProps = {
  locale: string;
  copy: Record<string, string>;
  copyState: string;
  pending: boolean;
  comparePending: boolean;
  benchmarkPending: boolean;
  hasEnoughTargets: boolean;
  compareResult: AgentCompareResponse | null;
  benchmarkResult: AgentBenchmarkResponse | null;
  compareError: string;
  benchmarkError: string;
  compareBenchmarkUseOutputContract: boolean;
  compareBenchmarkPreviewDiffOnly: boolean;
  compareBenchmarkPromptPreview: string;
  compareBenchmarkPromptDiffPreview: string;
  onRunCompare: () => void;
  onSendToBenchmark: () => void;
  onExportMarkdown: () => void;
  onCopyMarkdown: () => void;
  onCopy: (text: string, key: string) => void;
  onCompareBenchmarkUseOutputContractChange: (value: boolean) => void;
  onCompareBenchmarkPreviewDiffOnlyChange: (value: boolean) => void;
};

export function CompareRunHandoffPanel({
  locale,
  copy,
  copyState,
  pending,
  comparePending,
  benchmarkPending,
  hasEnoughTargets,
  compareResult,
  benchmarkResult,
  compareError,
  benchmarkError,
  compareBenchmarkUseOutputContract,
  compareBenchmarkPreviewDiffOnly,
  compareBenchmarkPromptPreview,
  compareBenchmarkPromptDiffPreview,
  onRunCompare,
  onSendToBenchmark,
  onExportMarkdown,
  onCopyMarkdown,
  onCopy,
  onCompareBenchmarkUseOutputContractChange,
  onCompareBenchmarkPreviewDiffOnlyChange,
}: CompareRunHandoffPanelProps) {
  const benchmarkPrompt = compareBenchmarkPreviewDiffOnly
    ? compareBenchmarkPromptDiffPreview
    : compareBenchmarkPromptPreview;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
        {locale.startsWith("en") ? "Execution handoff" : "执行交接"}
      </p>
      <div className="mt-4 space-y-3">
        <button
          type="button"
          disabled={!hasEnoughTargets || comparePending || pending}
          onClick={onRunCompare}
          className="w-full rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-left text-sm text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="block font-medium">
            {comparePending ? copy.runningCompare : copy.runCompare}
          </span>
          <span className="mt-1 block text-xs leading-6 text-cyan-100/80">
            {hasEnoughTargets
              ? copy.fairnessFingerprint
              : copy.needMoreTargets}
          </span>
        </button>
        <button
          type="button"
          disabled={!compareResult || benchmarkPending || comparePending}
          onClick={onSendToBenchmark}
          className="w-full rounded-2xl border border-violet-400/20 bg-violet-400/10 px-4 py-3 text-left text-sm text-violet-100 transition hover:bg-violet-400/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="block font-medium">
            {benchmarkPending ? copy.benchmarkPending : copy.benchmarkAction}
          </span>
          <span className="mt-1 block text-xs leading-6 text-violet-100/80">
            {copy.benchmarkHint}
          </span>
        </button>
        <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={compareBenchmarkUseOutputContract}
            onChange={(event) =>
              onCompareBenchmarkUseOutputContractChange(event.target.checked)
            }
            className="mt-1 rounded border-white/20 bg-slate-950"
          />
          <span>
            <span className="block font-medium">
              {copy.benchmarkContractToggle}
            </span>
            <span className="mt-1 block text-xs leading-6 text-slate-400">
              {copy.benchmarkContractHint}
            </span>
          </span>
        </label>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                {copy.benchmarkPromptPreview}
              </p>
              <p className="mt-2 text-xs leading-6 text-slate-400">
                {copy.benchmarkPromptPreviewHint}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-slate-200">
                <input
                  type="checkbox"
                  checked={compareBenchmarkPreviewDiffOnly}
                  onChange={(event) =>
                    onCompareBenchmarkPreviewDiffOnlyChange(
                      event.target.checked,
                    )
                  }
                  className="rounded border-white/20 bg-slate-950"
                />
                {copy.benchmarkPromptDiffOnly}
              </label>
              <button
                type="button"
                onClick={() => onCopy(benchmarkPrompt, "compare:benchmark-prompt")}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10"
              >
                {copyState === "compare:benchmark-prompt"
                  ? copy.copied
                  : copy.benchmarkPromptCopy}
              </button>
            </div>
          </div>
          <textarea
            readOnly
            value={benchmarkPrompt}
            rows={6}
            className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 font-mono text-xs leading-6 text-slate-200 outline-none"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={!compareResult}
            onClick={onExportMarkdown}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="block font-medium">{copy.exportMarkdown}</span>
            <span className="mt-1 block text-xs leading-6 text-slate-400">
              {compareResult ? copy.resultReviewHint : copy.noResults}
            </span>
          </button>
          <button
            type="button"
            disabled={!compareResult}
            onClick={onCopyMarkdown}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="block font-medium">
              {copyState === "compare:markdown"
                ? copy.copied
                : copy.copyMarkdown}
            </span>
            <span className="mt-1 block text-xs leading-6 text-slate-400">
              {compareResult ? copy.resultReviewHint : copy.noResults}
            </span>
          </button>
        </div>
        {pending ? (
          <p className="text-xs leading-6 text-cyan-200">
            {locale.startsWith("en")
              ? "A chat run is already in flight. Compare execution will reuse the same runtime guardrails."
              : "当前已有聊天请求进行中。compare 会继续复用同一套运行时保护逻辑。"}
          </p>
        ) : null}
        {compareError ? (
          <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-100">
            {compareError}
          </div>
        ) : null}
        {benchmarkError ? (
          <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-100">
            {benchmarkError}
          </div>
        ) : null}
        {compareResult?.warning ? (
          <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-100">
            <p className="text-[11px] uppercase tracking-[0.22em] text-amber-50/80">
              {copy.compareWarning}
            </p>
            <p className="mt-2">{compareResult.warning}</p>
          </div>
        ) : null}
        {compareResult?.results.some((lane) => !lane.ok) ? (
          <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-100">
            {copy.partialRun}
          </div>
        ) : null}
        {benchmarkResult?.runId ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-100">
            <p className="font-medium">{copy.benchmarkSuccess}</p>
            <p className="mt-1 text-xs text-emerald-100/90">
              runId: {benchmarkResult.runId}
            </p>
            {benchmarkResult.runNote ? (
              <p className="mt-2 text-xs leading-6 text-emerald-100/85">
                {copy.benchmarkRunNoteAttached}
              </p>
            ) : null}
            <a
              href="/admin"
              className="mt-2 inline-flex text-xs font-semibold text-emerald-50 underline underline-offset-4"
            >
              {copy.benchmarkOpen}
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
