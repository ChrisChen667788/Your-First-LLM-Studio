"use client";

import { useCallback, useEffect, useState } from "react";

type Provenance = {
  context: {
    authMode: "loopback-local" | "signed-identity-proxy";
    subjectId: string;
    workspaceId: string;
    organizationId: string;
    requestId: string;
  };
  action: {
    executionLocality: "local" | "remote";
    dataBoundary: "loopback-local" | "signed-identity-proxy";
    sessionPersistenceBoundary: string;
  };
  error?: { message?: string };
};

function short(value: string) {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

export function WorkspaceActionProvenanceChip({
  execution,
  locale,
}: {
  execution: "local" | "remote";
  locale: string;
}) {
  const en = locale.startsWith("en");
  const [provenance, setProvenance] = useState<Provenance | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(
        `/api/governance/workspace-provenance?execution=${encodeURIComponent(execution)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as Provenance;
      if (!response.ok || !payload.context) {
        throw new Error(payload.error?.message || "Workspace context is unavailable.");
      }
      setProvenance(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Workspace context is unavailable.");
    }
  }, [execution]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (error) {
    return <span title={error} className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-100">{en ? "Context HOLD" : "上下文 HOLD"}</span>;
  }
  if (!provenance) {
    return <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-400">{en ? "Context checking" : "上下文检查中"}</span>;
  }
  const tone = provenance.context.authMode === "signed-identity-proxy"
    ? "border-violet-400/20 bg-violet-400/10 text-violet-100"
    : "border-cyan-400/20 bg-cyan-400/10 text-cyan-100";
  return (
    <button
      type="button"
      onClick={() => void refresh()}
      title={`${provenance.context.subjectId} · ${provenance.context.workspaceId} · ${provenance.context.organizationId} · ${provenance.context.requestId}`}
      className={`rounded-full border px-2.5 py-1 text-[11px] ${tone}`}
    >
      {en ? "Context" : "上下文"}: {short(provenance.context.workspaceId)} · {provenance.action.executionLocality} · {provenance.action.dataBoundary === "loopback-local" ? "loopback" : "signed"}
    </button>
  );
}
