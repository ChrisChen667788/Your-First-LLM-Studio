"use client";

import dynamic from "next/dynamic";
import type { CompareWorkbenchProps } from "@/features/compare/CompareWorkbench";

const CompareWorkbench = dynamic<CompareWorkbenchProps>(
  () =>
    import("@/features/compare/CompareWorkbench").then(
      (mod) => mod.CompareWorkbench,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4 px-5 py-5">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <div className="h-4 w-32 rounded-full bg-cyan-400/10" />
          <div className="mt-4 h-10 rounded-2xl bg-white/[0.05]" />
          <div className="mt-3 h-10 rounded-2xl bg-white/[0.05]" />
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <div className="h-4 w-40 rounded-full bg-white/[0.08]" />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="h-28 rounded-2xl bg-black/20" />
            <div className="h-28 rounded-2xl bg-black/20" />
          </div>
        </div>
      </div>
    ),
  },
);

export function CompareWorkbenchShell(props: CompareWorkbenchProps) {
  return <CompareWorkbench {...props} />;
}
