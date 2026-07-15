"use client";

import { useLocale } from "@/components/layout/LocaleProvider";
import { agentToolSpecs } from "@/lib/agent/catalog";
import { getLocalizedToolDescription, type AppLocale } from "@/lib/i18n";

export function AgentToolRegistryPanel({ locale }: { locale: AppLocale }) {
  const { dictionary } = useLocale();
  return (
    <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div><p className="text-xs uppercase tracking-[0.22em] text-slate-500">{dictionary.agent.toolRegistry}</p><p className="mt-2 text-sm leading-6 text-slate-400">{dictionary.agent.toolsAvailable}</p></div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">{agentToolSpecs.length}</span>
      </summary>
      <div className="mt-4 space-y-3">
        {agentToolSpecs.map((tool) => (
          <div key={tool.name} className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="font-mono text-xs text-cyan-300">{tool.name}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">{getLocalizedToolDescription(locale, tool.name, tool.description)}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
