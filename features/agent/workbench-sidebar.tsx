"use client";

import type { ReactNode } from "react";

type AgentWorkbenchSidebarProps = {
  identity: { eyebrow: string; title: string; subtitle: string };
  children: ReactNode;
};

export function AgentWorkbenchSidebar({
  identity,
  children,
}: AgentWorkbenchSidebarProps) {
  return (
    <aside className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/70 shadow-[0_30px_80px_rgba(2,6,23,0.55)] backdrop-blur xl:sticky xl:top-[5.25rem] xl:max-h-[calc(100vh-6.5rem)]">
      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-300">{identity.eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{identity.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{identity.subtitle}</p>
      </div>
      <div className="space-y-5 px-4 py-4 xl:max-h-[calc(100vh-12rem)] xl:overflow-y-auto">{children}</div>
    </aside>
  );
}
