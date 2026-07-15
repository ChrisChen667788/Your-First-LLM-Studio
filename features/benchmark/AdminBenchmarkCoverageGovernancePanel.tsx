type CoverageRow = {
  id: string;
  labelZh: string;
  labelEn: string;
  workloads: string[];
  publicCoverage: boolean;
  internalCoverage: boolean;
  nextPublicBenchmarkZh: string;
  nextPublicBenchmarkEn: string;
};

const COVERAGE_ROWS: CoverageRow[] = [
  { id: "latency-throughput", labelZh: "性能 / 首字延时 / 总耗时 / 吞吐", labelEn: "Latency / total time / throughput", workloads: ["latency-smoke"], publicCoverage: false, internalCoverage: true, nextPublicBenchmarkZh: "继续沿用内部 serving 回归协议。", nextPublicBenchmarkEn: "Keep the internal serving regression lane." },
  { id: "instruction-following", labelZh: "指令遵循 / 格式遵循", labelEn: "Instruction following / format discipline", workloads: ["instruction-following-lite", "ifeval-starter"], publicCoverage: true, internalCoverage: true, nextPublicBenchmarkZh: "IFEval 已托底。", nextPublicBenchmarkEn: "Already backed by IFEval." },
  { id: "chinese-knowledge", labelZh: "中文知识 / 中文专业能力", labelEn: "Chinese knowledge / domain understanding", workloads: ["ceval-cs-starter", "cmmlu-cs-starter"], publicCoverage: true, internalCoverage: false, nextPublicBenchmarkZh: "后续扩充 sample。", nextPublicBenchmarkEn: "Expand sample coverage later." },
  { id: "tool-calling", labelZh: "工具调用 / 参数格式", labelEn: "Tool calling / argument format", workloads: ["bfcl-starter"], publicCoverage: true, internalCoverage: true, nextPublicBenchmarkZh: "后续补 multi-step tool benchmark。", nextPublicBenchmarkEn: "Add a multi-step tool benchmark later." },
  { id: "long-context", labelZh: "长上下文材料问答", labelEn: "Long-context grounded QA", workloads: ["longbench-starter"], publicCoverage: true, internalCoverage: false, nextPublicBenchmarkZh: "需要时补 repo-long-context 专项集。", nextPublicBenchmarkEn: "Add repo-long-context coverage when needed." },
  { id: "grounded-rag", labelZh: "Grounded QA / RAG 引用 / 低置信度处理", labelEn: "Grounded QA / citation / low-confidence fallback", workloads: ["grounded-kb-qa"], publicCoverage: false, internalCoverage: true, nextPublicBenchmarkZh: "下一步可补 CRAG / RAGBench。", nextPublicBenchmarkEn: "Next public candidates: CRAG / RAGBench." },
  { id: "repo-qa", labelZh: "仓库级代码检索问答 / Repo QA", labelEn: "Repo-grounded code QA", workloads: ["code-rag-repo-qa"], publicCoverage: false, internalCoverage: true, nextPublicBenchmarkZh: "下一步可补 RepoBench。", nextPublicBenchmarkEn: "Next public candidate: RepoBench." },
  { id: "agent-workflow", labelZh: "Agent 规划 / 记忆 / 恢复 / 状态持久化", labelEn: "Agent planning / memory / recovery / state", workloads: ["agent-flow-lite"], publicCoverage: false, internalCoverage: true, nextPublicBenchmarkZh: "下一步可补 tau-bench / ToolSandbox。", nextPublicBenchmarkEn: "Next public candidates: tau-bench / ToolSandbox." },
  { id: "codegen", labelZh: "代码生成", labelEn: "Code generation", workloads: ["humaneval-starter", "mbppplus-starter"], publicCoverage: true, internalCoverage: false, nextPublicBenchmarkZh: "强调仓库修复时补 SWE-bench Lite。", nextPublicBenchmarkEn: "Add SWE-bench Lite for repository repair." },
];

export function AdminBenchmarkCoverageGovernancePanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const publicCount = COVERAGE_ROWS.filter((row) => row.publicCoverage).length;
  const internalCount = COVERAGE_ROWS.filter((row) => row.internalCoverage).length;
  return (
    <details className="rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3">
      <summary className="cursor-pointer list-none text-xs font-semibold text-slate-300">
        {en ? "Benchmark coverage governance" : "Benchmark 覆盖治理"}
        <span className="ml-2 text-[11px] font-normal text-slate-500">
          public {publicCount}/{COVERAGE_ROWS.length} · internal {internalCount}/{COVERAGE_ROWS.length}
        </span>
      </summary>
      <div className="mt-3 grid gap-2 xl:grid-cols-2">
        {COVERAGE_ROWS.map((row) => (
          <div key={row.id} className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-xs font-semibold text-slate-100">{en ? row.labelEn : row.labelZh}</p>
              <div className="flex gap-1.5 text-[10px]">
                <span className={`rounded-full border px-2 py-0.5 ${row.publicCoverage ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-white/5 text-slate-500"}`}>public</span>
                <span className={`rounded-full border px-2 py-0.5 ${row.internalCoverage ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/5 text-slate-500"}`}>internal</span>
              </div>
            </div>
            <p className="mt-2 font-mono text-[11px] text-slate-400">{row.workloads.join(" · ")}</p>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">{en ? row.nextPublicBenchmarkEn : row.nextPublicBenchmarkZh}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
