"use client";

import { useCallback, useEffect, useState } from "react";

type GovernanceSummary = {
  requestContext?: {
    mode?: string;
    signedProxyConfigured?: boolean;
  };
  database?: {
    schemaVersion?: string;
    counts?: {
      organizations?: number;
      workspaces?: number;
      memberships?: number;
      directoryGroups?: number;
      directoryGroupMembers?: number;
      groupWorkspaceMappings?: number;
      resources?: number;
      auditEvents?: number;
    };
    migrationRows?: Array<{ version?: number; name?: string }>;
  };
  postgresRls?: {
    latestPassing?: { generatedAt?: string; engine?: string } | null;
  };
  identityProvisioning?: {
    oidc?: { configured?: boolean };
    scim?: { configured?: boolean };
    blockers?: string[];
  };
  identityMapping?: {
    mappingCounts?: {
      groups?: number;
      groupMembers?: number;
      workspaceRoleMappings?: number;
    };
  };
  rehearsalEvidence?: {
    identityMapping?: { ok?: boolean; generatedAt?: string } | null;
    multiUserConflict?: {
      ok?: boolean;
      generatedAt?: string;
      conflict?: { status?: number; actualRevision?: number } | null;
    } | null;
  };
};

type WorkspaceResourceSummary = {
  resources?: Array<{ id: string; kind: string; label: string; role: string }>;
  audit?: Array<{ id?: string }>;
};

export function WorkspaceGovernancePanel({ locale }: { locale: string }) {
  const isEnglish = locale.startsWith("en");
  const [summary, setSummary] = useState<GovernanceSummary | null>(null);
  const [resources, setResources] = useState<WorkspaceResourceSummary | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setPending(true);
    setMessage("");
    try {
      const [governanceResponse, resourcesResponse] = await Promise.all([
        fetch("/api/governance", { cache: "no-store" }),
        fetch("/api/governance/workspaces/resources?includeAudit=1", {
          cache: "no-store",
        }),
      ]);
      const governancePayload =
        (await governanceResponse.json()) as GovernanceSummary & {
          error?: string;
        };
      const resourcesPayload =
        (await resourcesResponse.json()) as WorkspaceResourceSummary & {
          error?: { message?: string };
        };
      if (!governanceResponse.ok) {
        throw new Error(governancePayload.error || "Governance read failed.");
      }
      if (!resourcesResponse.ok) {
        throw new Error(
          resourcesPayload.error?.message || "Workspace resource read failed.",
        );
      }
      setSummary(governancePayload);
      setResources(resourcesPayload);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Governance read failed.",
      );
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runRehearsal = useCallback(async () => {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/governance", { method: "POST" });
      const payload = (await response.json()) as {
        rehearsal?: { ok?: boolean };
        identityMappingRehearsal?: { ok?: boolean };
        conflictRehearsal?: { ok?: boolean };
        error?: string;
      };
      if (
        !response.ok ||
        !payload.rehearsal?.ok ||
        !payload.identityMappingRehearsal?.ok ||
        !payload.conflictRehearsal?.ok
      ) {
        throw new Error(payload.error || "Workspace rehearsal failed.");
      }
      setMessage(
        isEnglish
          ? "Isolation, identity mapping, and multi-user conflict rehearsals passed."
          : "隔离、身份映射和多用户冲突演练均已通过。",
      );
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Workspace rehearsal failed.",
      );
    } finally {
      setPending(false);
    }
  }, [isEnglish, refresh]);

  const counts = summary?.database?.counts;
  const postgresReady = Boolean(summary?.postgresRls?.latestPassing);
  const identityReady = Boolean(
    summary?.identityProvisioning?.oidc?.configured &&
      summary?.identityProvisioning?.scim?.configured,
  );

  return (
    <section className="border-y border-white/10 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Workspace governance
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            {isEnglish ? "Tenant isolation and identity" : "租户隔离与身份治理"}
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={pending}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-50"
          >
            {isEnglish ? "Refresh" : "刷新"}
          </button>
          <button
            type="button"
            onClick={() => void runRehearsal()}
            disabled={pending}
            className="rounded-full bg-emerald-300 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
          >
            {isEnglish ? "Run isolation check" : "运行隔离检查"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-6">
        {[
          [
            isEnglish ? "Identity context" : "身份上下文",
            summary?.requestContext?.mode || "--",
            summary?.requestContext?.signedProxyConfigured
              ? "signed"
              : "loopback",
          ],
          [
            isEnglish ? "SQLite ACL" : "SQLite ACL",
            isEnglish
              ? `${counts?.workspaces || 0} workspace`
              : `${counts?.workspaces || 0} 个工作区`,
            isEnglish
              ? `${counts?.memberships || 0} membership`
              : `${counts?.memberships || 0} 条成员关系`,
          ],
          [
            isEnglish ? "Postgres RLS" : "Postgres RLS",
            postgresReady ? "PASS" : "HOLD",
            summary?.postgresRls?.latestPassing?.engine ||
              (isEnglish ? "no receipt" : "暂无回执"),
          ],
          [
            isEnglish ? "Identity provisioning" : "身份供应",
            identityReady ? "READY" : "HOLD",
            `OIDC ${summary?.identityProvisioning?.oidc?.configured ? "on" : "off"} · SCIM ${summary?.identityProvisioning?.scim?.configured ? "on" : "off"}`,
          ],
          [
            isEnglish ? "Group mappings" : "用户组映射",
            `${summary?.identityMapping?.mappingCounts?.workspaceRoleMappings || 0}`,
            isEnglish
              ? `${summary?.identityMapping?.mappingCounts?.groupMembers || 0} mapped members`
              : `${summary?.identityMapping?.mappingCounts?.groupMembers || 0} 个映射成员`,
          ],
          [
            isEnglish ? "Write conflicts" : "写入冲突",
            summary?.rehearsalEvidence?.multiUserConflict?.ok
              ? "PASS"
              : "HOLD",
            summary?.rehearsalEvidence?.multiUserConflict?.conflict?.status
              ? `HTTP ${summary.rehearsalEvidence.multiUserConflict.conflict.status} · rev ${summary.rehearsalEvidence.multiUserConflict.conflict.actualRevision || "--"}`
              : isEnglish
                ? "no receipt"
                : "暂无回执",
          ],
        ].map(([label, value, detail]) => (
          <div key={label} className="bg-slate-950/80 px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
            <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
        <span>
          {isEnglish
            ? `${resources?.resources?.length || 0} resources visible`
            : `可见资源 ${resources?.resources?.length || 0} 个`}
        </span>
        <span>·</span>
        <span>
          {isEnglish
            ? `${counts?.auditEvents || resources?.audit?.length || 0} audit events`
            : `审计事件 ${counts?.auditEvents || resources?.audit?.length || 0} 条`}
        </span>
        <span>·</span>
        <span>
          {isEnglish
            ? `${summary?.database?.migrationRows?.length || 0} SQLite migrations`
            : `SQLite 迁移 ${summary?.database?.migrationRows?.length || 0} 个`}
        </span>
      </div>
      {message ? (
        <p className="mt-3 border-l-2 border-emerald-300 pl-3 text-xs text-slate-300">
          {message}
        </p>
      ) : null}
    </section>
  );
}
