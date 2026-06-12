"use client";

import { getLocalizedTargetDescription } from "@/lib/i18n";
import type { AppLocale } from "@/lib/i18n";
import type {
  AgentConnectionCheckResponse,
  AgentTarget,
} from "@/lib/agent/types";
import {
  formatTargetModelVersion,
  getHealthBadge,
  getLoadRiskBadge,
} from "./runtime-formatters";

type TargetCatalogPanelLabels = {
  targets: string;
  model: string;
  local: string;
  remote: string;
  healthHealthy: string;
  healthWarning: string;
  healthDegraded: string;
  healthUnknown: string;
};

type TargetCatalogPanelProps = {
  locale: AppLocale;
  targets: AgentTarget[];
  selectedTargetId: string;
  connectionChecksByTargetId: Record<string, AgentConnectionCheckResponse>;
  scanTargetsPending: boolean;
  scanTargetsMessage: string;
  scanTargetsMessageTone: "success" | "error";
  labels: TargetCatalogPanelLabels;
  onScanTargets: () => void | Promise<void>;
  onSelectTarget: (targetId: string) => void;
};

export function TargetCatalogPanel({
  locale,
  targets,
  selectedTargetId,
  connectionChecksByTargetId,
  scanTargetsPending,
  scanTargetsMessage,
  scanTargetsMessageTone,
  labels,
  onScanTargets,
  onSelectTarget,
}: TargetCatalogPanelProps) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
          {labels.targets}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void onScanTargets()}
            disabled={scanTargetsPending}
            className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {scanTargetsPending
              ? locale.startsWith("en")
                ? "Scanning..."
                : "扫描中..."
              : locale.startsWith("en")
                ? "Scan models / APIs"
                : "一键扫描新模型 / API"}
          </button>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
            {targets.length}
          </span>
        </div>
      </div>
      {scanTargetsMessage ? (
        <div
          className={`mb-3 rounded-2xl border px-3 py-2 text-[11px] leading-5 ${
            scanTargetsMessageTone === "success"
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
              : "border-rose-400/20 bg-rose-400/10 text-rose-100"
          }`}
        >
          {scanTargetsMessage}
        </div>
      ) : null}
      <div className="space-y-2">
        {targets.map((target) => {
          const active = target.id === selectedTargetId;
          const targetConnectionCheck =
            connectionChecksByTargetId[target.id] || null;
          const healthBadge = getHealthBadge(targetConnectionCheck);
          const loadRiskBadge = getLoadRiskBadge(target, locale);
          return (
            <button
              key={target.id}
              type="button"
              onClick={() => onSelectTarget(target.id)}
              className={`w-full rounded-[22px] border px-3 py-2.5 text-left transition ${
                active
                  ? "border-cyan-400/45 bg-cyan-400/[0.08] shadow-[0_0_0_1px_rgba(34,211,238,0.1)]"
                  : "border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.06]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 pr-2">
                  <p className="line-clamp-2 text-[15px] font-semibold leading-5 text-white">
                    {target.label}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
                    {target.providerLabel}
                  </p>
                  <p className="mt-1 line-clamp-1 text-[10px] text-slate-500">
                    {labels.model}:{" "}
                    {formatTargetModelVersion(
                      target.modelDefault,
                      target.thinkingModelDefault,
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`whitespace-nowrap rounded-full px-2 py-[3px] text-[10px] uppercase leading-none tracking-[0.2em] ${
                      target.execution === "local"
                        ? "bg-emerald-400/10 text-emerald-300"
                        : "bg-violet-400/10 text-violet-300"
                    }`}
                  >
                    {target.execution === "local" ? labels.local : labels.remote}
                  </span>
                  {target.execution === "remote" ? (
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-[3px] text-[10px] uppercase leading-none tracking-[0.2em] ${healthBadge.className}`}
                    >
                      {healthBadge.label === "healthy"
                        ? labels.healthHealthy
                        : healthBadge.label === "warning"
                          ? labels.healthWarning
                          : healthBadge.label === "degraded"
                            ? labels.healthDegraded
                            : labels.healthUnknown}
                    </span>
                  ) : null}
                  {loadRiskBadge ? (
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-[3px] text-[10px] font-semibold leading-none tracking-[0.08em] ${loadRiskBadge.className}`}
                    >
                      {loadRiskBadge.label}
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-[12.5px] leading-6 text-slate-400">
                {getLocalizedTargetDescription(
                  locale,
                  target.id,
                  target.description,
                )}
              </p>
              {target.execution === "local" && target.loadGuardrailSummary ? (
                <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-slate-500">
                  {target.loadGuardrailSummary}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
