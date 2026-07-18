"use client";

import { useCallback, useEffect, useState } from "react";

type AcceptanceReceipt = {
  status: "pass" | "hold";
  checks: Record<string, boolean>;
  lifecycle: {
    extensionId: string;
    installedVersion: string;
    updatedVersion: string;
    rollbackVersion: string;
  };
  security: {
    sandbox: string;
    osEnforced: boolean;
    maliciousPackageQuarantined: boolean;
    traversalBundleRejected: boolean;
    dependencyConflictBlocked: boolean;
  };
  mcp: {
    serverId: string;
    packageName: string;
    packageVersion: string;
    tools: number;
    readOnlyTools: number;
    destructiveTools: number;
    transport: "stdio";
  };
  blockers: string[];
  evidenceDigest: string;
};

type AcceptancePayload = {
  ok: true;
  latest: AcceptanceReceipt | null;
  latestPassing: AcceptanceReceipt | null;
};

type PromotionPayload = {
  ok: true;
  localStatus: "pass" | "evidence-needed";
  productionStatus: "hold";
  localChecks: Record<string, boolean>;
  localBlockers: string[];
  productionBlockers: string[];
  evidenceDigest: string;
};

type RegistryPayload = {
  ok: true;
  totals: {
    registered: number;
    enabled: number;
    passing: number;
    stdio: number;
  };
};

function statusTone(passing: boolean) {
  return passing
    ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
    : "border-amber-300/30 bg-amber-400/10 text-amber-100";
}

export function ExtensionEcosystemEvidencePanel({
  locale,
}: {
  locale: string;
}) {
  const en = locale.startsWith("en");
  const [acceptance, setAcceptance] =
    useState<AcceptancePayload | null>(null);
  const [promotion, setPromotion] =
    useState<PromotionPayload | null>(null);
  const [registry, setRegistry] = useState<RegistryPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [acceptanceResponse, promotionResponse, registryResponse] =
      await Promise.all([
        fetch("/api/extensions/acceptance", { cache: "no-store" }),
        fetch("/api/extensions/promotion", { cache: "no-store" }),
        fetch("/api/extensions/mcp-servers", { cache: "no-store" }),
      ]);
    if (
      !acceptanceResponse.ok ||
      !promotionResponse.ok ||
      !registryResponse.ok
    ) {
      throw new Error("Failed to load extension ecosystem evidence.");
    }
    const [acceptanceBody, promotionBody, registryBody] =
      (await Promise.all([
        acceptanceResponse.json(),
        promotionResponse.json(),
        registryResponse.json(),
      ])) as [AcceptancePayload, PromotionPayload, RegistryPayload];
    setAcceptance(acceptanceBody);
    setPromotion(promotionBody);
    setRegistry(registryBody);
  }, []);

  useEffect(() => {
    void load().catch((caught) =>
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to load extension ecosystem evidence.",
      ),
    );
  }, [load]);

  const runAcceptance = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/extensions/acceptance", {
        method: "POST",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "Extension acceptance failed.");
      }
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Extension acceptance failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const receipt = acceptance?.latestPassing || acceptance?.latest;
  const passedChecks = receipt
    ? Object.values(receipt.checks).filter(Boolean).length
    : 0;
  const totalChecks = receipt ? Object.keys(receipt.checks).length : 0;
  const localPass = promotion?.localStatus === "pass";

  return (
    <section
      id="extension-ecosystem-acceptance"
      data-evidence-ready={Boolean(receipt && promotion && registry)}
      className="border border-cyan-300/20 bg-slate-950/75 p-5 backdrop-blur"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
            EXTENSION ECOSYSTEM · V1.3.0
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {en
              ? "Permissioned MCP and signed extensions"
              : "权限化 MCP 与签名扩展生态"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {en
              ? "Runs a pinned community MCP server through stdio, verifies signed install/update/rollback, and keeps destructive tools behind permission, quarantine, and an OS-enforced sandbox."
              : "通过 stdio 运行锁定版本的社区 MCP server，并验证签名安装、更新和回滚；破坏性工具继续受权限、隔离区与 OS 级 sandbox 约束。"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`border px-3 py-2 text-xs font-semibold uppercase ${statusTone(localPass)}`}
          >
            LOCAL {promotion?.localStatus || "loading"}
          </span>
          <span className="border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold uppercase text-amber-100">
            PROD {promotion?.productionStatus || "loading"}
          </span>
          <button
            type="button"
            onClick={() => void runAcceptance()}
            disabled={busy}
            className="border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-400/20 disabled:opacity-50"
          >
            {busy
              ? en
                ? "Running…"
                : "运行中…"
              : en
                ? "Run acceptance"
                : "运行验收"}
          </button>
          <button
            type="button"
            onClick={() =>
              void load().catch((caught) =>
                setError(
                  caught instanceof Error
                    ? caught.message
                    : "Refresh failed.",
                ),
              )
            }
            className="border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
          >
            {en ? "Refresh" : "刷新"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["MCP SERVERS", `${registry?.totals.passing || 0}/${registry?.totals.registered || 0}`],
          ["TOOLS", String(receipt?.mcp.tools || 0)],
          ["READ ONLY", String(receipt?.mcp.readOnlyTools || 0)],
          ["DESTRUCTIVE", String(receipt?.mcp.destructiveTools || 0)],
          ["SECURITY CHECKS", `${passedChecks}/${totalChecks}`],
          ["SANDBOX", receipt?.security.sandbox || "—"],
        ].map(([label, value]) => (
          <div key={label} className="bg-slate-950 px-3 py-3">
            <p className="text-[10px] uppercase text-slate-500">{label}</p>
            <p className="mt-1 break-words text-sm font-semibold text-white">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-4">
        <article className="border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] uppercase text-slate-500">
            SIGNED LIFECYCLE
          </p>
          <p className="mt-2 text-sm font-semibold text-white">
            {receipt
              ? `${receipt.lifecycle.installedVersion} → ${receipt.lifecycle.updatedVersion} → ${receipt.lifecycle.rollbackVersion}`
              : "—"}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Ed25519 verification, atomic activation and reversible rollback.
          </p>
        </article>
        <article className="border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] uppercase text-slate-500">
            PACKAGE DEFENSE
          </p>
          <p className="mt-2 text-sm font-semibold text-emerald-100">
            {receipt?.security.maliciousPackageQuarantined &&
            receipt.security.traversalBundleRejected
              ? "TAMPER + TRAVERSAL DENIED"
              : "EVIDENCE NEEDED"}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Digest mismatch enters quarantine; signed path traversal is
            rejected before activation.
          </p>
        </article>
        <article className="border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] uppercase text-slate-500">REAL MCP</p>
          <p className="mt-2 break-words text-sm font-semibold text-white">
            {receipt
              ? `${receipt.mcp.packageName}@${receipt.mcp.packageVersion}`
              : "—"}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Pinned npm integrity, stdio initialization and MCP tool
            annotations.
          </p>
        </article>
        <article className="border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] uppercase text-slate-500">
            OS ISOLATION
          </p>
          <p className="mt-2 text-sm font-semibold text-emerald-100">
            {receipt?.security.osEnforced
              ? "WRITE + NETWORK DENIED"
              : "EVIDENCE NEEDED"}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Read-only MCP root under macOS Seatbelt; extension secrets stay
            broker-only.
          </p>
        </article>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {receipt
          ? Object.entries(receipt.checks).map(([check, passed]) => (
              <span
                key={check}
                className={`border px-2 py-1 text-[10px] ${statusTone(passed)}`}
              >
                {passed ? "PASS" : "HOLD"} · {check}
              </span>
            ))
          : null}
      </div>

      <div className="mt-4 border-t border-white/10 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200">
          PRODUCTION GATES
        </p>
        <div className="mt-2 grid gap-2 lg:grid-cols-2">
          {promotion?.productionBlockers.map((blocker) => (
            <p
              key={blocker}
              className="border border-amber-300/15 bg-amber-400/5 px-3 py-2 text-xs leading-5 text-amber-100"
            >
              {blocker}
            </p>
          ))}
        </div>
        <p className="mt-3 break-all text-[10px] text-slate-600">
          SHA-256 evidence · {promotion?.evidenceDigest || "—"}
        </p>
      </div>
    </section>
  );
}
