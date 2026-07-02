"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type RuntimeProfile = {
  id: string;
  label: string;
  description: string;
  targetId: string;
  temperature: number;
  contextWindow: number;
  enableTools: boolean;
  enableRetrieval: boolean;
  thinkingMode: "standard" | "thinking";
  providerProfile: "speed" | "balanced" | "tool-first";
  hardwareBudget: string;
  ragPolicy: string;
  source: "builtin" | "user";
  createdAt: string;
  updatedAt: string;
};

type RuntimeProfileRegistry = {
  generatedAt: string;
  profiles: RuntimeProfile[];
};

type IdleUnloadConfig = {
  enabled: boolean;
  idleMinutes: number;
  memoryPressureRelease: boolean;
  preserveAdapters: boolean;
  applyMode: "config-only" | "daemon-managed";
  updatedAt: string;
  notes: string[];
};

type RequestLogEntry = {
  id: string;
  targetId: string;
  targetLabel: string;
  providerLabel: string;
  resolvedModel: string;
  resolvedBaseUrl: string;
  completedAt: string;
  latencyMs: number;
  firstTokenLatencyMs?: number;
  tokenThroughputTps?: number;
  ok: boolean;
  inputPreview: string;
  outputPreview: string;
  toolRunsCount: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  warning?: string;
};

type RequestLogSummary = {
  total: number;
  ok: number;
  failed: number;
  avgLatencyMs: number | null;
  totalTokens: number;
  entries: RequestLogEntry[];
};

type RuntimePaths = {
  profileRegistryFile: string;
  idleUnloadConfigFile: string;
  chatHistoryFile: string;
};

type DeveloperApiGuide = {
  endpoint: string;
  chatCompletionsUrl: string;
  modelsUrl: string;
  apiKeyEnv: string;
  keyStatus: "configured" | "missing" | "not-required";
  curlExample: string;
  openaiSdkExample: string;
  tokenAccountingFields: string[];
  latencyFields: string[];
};

type RuntimeTargetCard = {
  targetId: string;
  label: string;
  providerLabel: string;
  execution: string;
  resolvedModel: string;
  endpoint: string;
  chatCompletionsUrl: string;
  modelsUrl: string;
  apiKeyEnv?: string;
  keyStatus: "configured" | "missing" | "not-required";
  recommendedContext?: string;
  recommendedContextWindow?: number;
  memoryProfile?: string;
  profileCount: number;
  profileLabels: string[];
  toolEnabledProfileCount: number;
  ragEnabledProfileCount: number;
  idleUnloadEnabled: boolean;
  idleMinutes: number;
  requestCount: number;
  failureCount: number;
  totalTokens: number;
  avgLatencyMs: number | null;
  lastRequestAt?: string;
};

type ModelHubRuntimePanelProps = {
  embedded?: boolean;
};

type RuntimeProfileDraft = Pick<
  RuntimeProfile,
  | "id"
  | "label"
  | "description"
  | "targetId"
  | "temperature"
  | "contextWindow"
  | "enableTools"
  | "enableRetrieval"
  | "thinkingMode"
  | "providerProfile"
  | "hardwareBudget"
  | "ragPolicy"
>;

const EMPTY_PROFILE: RuntimeProfileDraft = {
  id: "",
  label: "",
  description: "",
  targetId: "local-qwen35-4b-4bit",
  temperature: 0.2,
  contextWindow: 16384,
  enableTools: true,
  enableRetrieval: false,
  thinkingMode: "standard",
  providerProfile: "balanced",
  hardwareBudget: "",
  ragPolicy: "",
};

function formatNumber(value?: number | null, suffix = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${value.toFixed(value < 10 ? 1 : 0)}${suffix}`;
}

function formatDate(value?: string) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function profileTone(source: RuntimeProfile["source"]) {
  return source === "builtin"
    ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
    : "border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
}

export function ModelHubRuntimePanel({ embedded = false }: ModelHubRuntimePanelProps) {
  const [registry, setRegistry] = useState<RuntimeProfileRegistry | null>(null);
  const [idleConfig, setIdleConfig] = useState<IdleUnloadConfig | null>(null);
  const [logs, setLogs] = useState<RequestLogSummary | null>(null);
  const [paths, setPaths] = useState<RuntimePaths | null>(null);
  const [developerApi, setDeveloperApi] = useState<DeveloperApiGuide | null>(null);
  const [targetCards, setTargetCards] = useState<RuntimeTargetCard[]>([]);
  const [profileDraft, setProfileDraft] = useState(EMPTY_PROFILE);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const userProfiles = useMemo(
    () => registry?.profiles.filter((profile) => profile.source === "user") || [],
    [registry],
  );

  const builtinProfiles = useMemo(
    () => registry?.profiles.filter((profile) => profile.source === "builtin") || [],
    [registry],
  );

  const loadLogs = useCallback(async () => {
    const response = await fetch("/api/models/local-server/logs?limit=60", { cache: "no-store" });
    const payload = (await response.json()) as {
      logs?: RequestLogSummary;
      paths?: RuntimePaths;
      error?: string;
    };
    if (!response.ok || !payload.logs) throw new Error(payload.error || "Failed to load request logs.");
    setLogs(payload.logs);
    if (payload.paths) setPaths(payload.paths);
  }, []);

  const loadAll = useCallback(async () => {
    setPending("load");
    setError("");
    try {
      const response = await fetch("/api/models/runtime-operations?limit=60", { cache: "no-store" });
      const payload = (await response.json()) as {
        operations?: {
          registry: RuntimeProfileRegistry;
          idleUnload: IdleUnloadConfig;
          requestLogs: RequestLogSummary;
          developerApi: DeveloperApiGuide;
          targetCards: RuntimeTargetCard[];
          paths: RuntimePaths;
        };
        error?: string;
      };
      if (!response.ok || !payload.operations) {
        throw new Error(payload.error || "Failed to load Model Hub runtime operations.");
      }
      setRegistry(payload.operations.registry);
      setIdleConfig(payload.operations.idleUnload);
      setLogs(payload.operations.requestLogs);
      setDeveloperApi(payload.operations.developerApi);
      setTargetCards(payload.operations.targetCards || []);
      setPaths(payload.operations.paths);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load Model Hub runtime panel.");
    } finally {
      setPending("");
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function editProfile(profile: RuntimeProfile) {
    setProfileDraft({
      id: profile.source === "builtin" ? `${profile.id}-custom` : profile.id,
      label: profile.source === "builtin" ? `${profile.label} custom` : profile.label,
      description: profile.description,
      targetId: profile.targetId,
      temperature: profile.temperature,
      contextWindow: profile.contextWindow,
      enableTools: profile.enableTools,
      enableRetrieval: profile.enableRetrieval,
      thinkingMode: profile.thinkingMode,
      providerProfile: profile.providerProfile,
      hardwareBudget: profile.hardwareBudget,
      ragPolicy: profile.ragPolicy,
    });
  }

  async function saveProfile() {
    if (!profileDraft.label.trim()) {
      setError("Profile label is required.");
      return;
    }
    setPending("save-profile");
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/models/runtime-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileDraft),
      });
      const payload = (await response.json()) as {
        registry?: RuntimeProfileRegistry;
        paths?: RuntimePaths;
        error?: string;
      };
      if (!response.ok || !payload.registry) throw new Error(payload.error || "Failed to save profile.");
      setRegistry(payload.registry);
      if (payload.paths) setPaths(payload.paths);
      setProfileDraft(EMPTY_PROFILE);
      setMessage("Runtime profile saved to the backend registry.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save profile.");
    } finally {
      setPending("");
    }
  }

  async function deleteProfile(profileId: string) {
    setPending(`delete:${profileId}`);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/models/runtime-profiles?id=${encodeURIComponent(profileId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as {
        registry?: RuntimeProfileRegistry;
        paths?: RuntimePaths;
        error?: string;
      };
      if (!response.ok || !payload.registry) throw new Error(payload.error || "Failed to delete profile.");
      setRegistry(payload.registry);
      if (payload.paths) setPaths(payload.paths);
      setMessage("Runtime profile removed from the backend registry.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete profile.");
    } finally {
      setPending("");
    }
  }

  async function saveIdleConfig() {
    if (!idleConfig) return;
    setPending("save-idle");
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/models/local-server/idle-unload", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(idleConfig),
      });
      const payload = (await response.json()) as {
        config?: IdleUnloadConfig;
        paths?: RuntimePaths;
        error?: string;
      };
      if (!response.ok || !payload.config) throw new Error(payload.error || "Failed to save idle config.");
      setIdleConfig(payload.config);
      if (payload.paths) setPaths(payload.paths);
      setMessage("Idle-unload config saved for the local server daemon.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save idle config.");
    } finally {
      setPending("");
    }
  }

  return (
    <section className={embedded ? "text-slate-100" : "min-h-screen bg-[#031513] px-6 py-6 text-slate-100"}>
      <section className={embedded ? "space-y-5" : "mx-auto max-w-[1680px] rounded-[32px] border border-white/10 bg-slate-950/80 p-5 shadow-[0_28px_90px_rgba(2,8,23,0.5)]"}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-300">MODEL HUB RUNTIME</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Persistent profiles, request logs, and idle unload</h1>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-300">
              Runtime Profiles now live in a backend registry. Local Server logs and idle-unload config are managed from the same server-first workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!embedded ? (
              <a href="/models" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10">
                Back to Models
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => void loadAll()}
              disabled={pending === "load"}
              className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/15 disabled:opacity-60"
            >
              {pending === "load" ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {(message || error) ? (
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${error ? "border-rose-300/20 bg-rose-400/10 text-rose-100" : "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"}`}>
            {error || message}
          </div>
        ) : null}

        <section className="mt-5 rounded-3xl border border-emerald-300/15 bg-emerald-300/8 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Runtime target cards</p>
              <p className="mt-1 text-xs leading-5 text-emerald-100/70">
                OpenAI-compatible server state, profiles, request logs, and idle-unload policy are now visible beside the model catalog.
              </p>
            </div>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-emerald-100">
              {targetCards.length} targets
            </span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {targetCards.slice(0, 9).map((target) => (
              <article
                key={target.targetId}
                className="rounded-[26px] border border-white/10 bg-slate-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-white">{target.label}</p>
                    <p className="mt-1 truncate text-xs text-slate-400">{target.resolvedModel}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${
                    target.execution === "local"
                      ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                      : "border-violet-300/20 bg-violet-400/10 text-violet-100"
                  }`}>
                    {target.execution}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em] text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{target.providerLabel}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                    {target.recommendedContext || (target.recommendedContextWindow ? `${Math.round(target.recommendedContextWindow / 1024)}K` : "context --")}
                  </span>
                  <span className={`rounded-full border px-2.5 py-1 ${
                    target.keyStatus === "missing"
                      ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
                      : "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
                  }`}>
                    key {target.keyStatus}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-300">
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Requests</p>
                    <p className="mt-1 font-semibold text-white">{target.requestCount}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Latency</p>
                    <p className="mt-1 font-semibold text-white">{formatNumber(target.avgLatencyMs, " ms")}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Tokens</p>
                    <p className="mt-1 font-semibold text-white">{target.totalTokens}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Profiles {target.profileCount}</span>
                    <span>Tools {target.toolEnabledProfileCount} · RAG {target.ragEnabledProfileCount}</span>
                  </div>
                  <p className="mt-2 line-clamp-1 text-slate-500">
                    {target.profileLabels.length ? target.profileLabels.join(" · ") : "No saved runtime profile yet"}
                  </p>
                </div>
                <div className="mt-3 rounded-2xl border border-cyan-300/15 bg-cyan-400/10 px-3 py-2 text-xs leading-5 text-cyan-50/85">
                  <p className="break-all">{target.chatCompletionsUrl}</p>
                  <p className="mt-1 text-cyan-100/60">
                    Idle unload {target.idleUnloadEnabled ? `${target.idleMinutes} min` : "off"}
                    {target.failureCount ? ` · ${target.failureCount} failed` : ""}
                    {target.lastRequestAt ? ` · ${formatDate(target.lastRequestAt)}` : ""}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.42fr)]">
          <section className="rounded-3xl border border-white/10 bg-black/25 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Runtime Profile Registry</p>
                <p className="mt-1 text-xs text-slate-400">{paths?.profileRegistryFile || "Loading profile registry path..."}</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                {(registry?.profiles.length || 0)} profiles
              </span>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {[...builtinProfiles, ...userProfiles].map((profile) => (
                <article key={profile.id} className="rounded-[26px] border border-white/10 bg-slate-950/70 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold text-white">{profile.label}</p>
                      <p className="mt-1 text-xs text-slate-400">{profile.targetId}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${profileTone(profile.source)}`}>
                      {profile.source}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{profile.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-300">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">T {profile.temperature}</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{Math.round(profile.contextWindow / 1024)}K</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Tools {profile.enableTools ? "on" : "off"}</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">RAG {profile.enableRetrieval ? "on" : "off"}</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{profile.thinkingMode}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => editProfile(profile)}
                      className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-50 hover:bg-cyan-400/15"
                    >
                      {profile.source === "builtin" ? "Clone" : "Edit"}
                    </button>
                    {profile.source === "user" ? (
                      <button
                        type="button"
                        onClick={() => void deleteProfile(profile.id)}
                        disabled={pending === `delete:${profile.id}`}
                        className="rounded-full border border-rose-300/20 bg-rose-400/10 px-3 py-1.5 text-[11px] font-semibold text-rose-100 hover:bg-rose-400/15 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-3xl border border-white/10 bg-black/25 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Developer API</p>
                  <p className="mt-1 break-all text-xs text-slate-400">
                    {developerApi?.endpoint || "OpenAI-compatible endpoint"}
                  </p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${
                  developerApi?.keyStatus === "missing"
                    ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
                    : "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                }`}>
                  {developerApi?.keyStatus || "loading"}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2">
                  <p className="uppercase tracking-[0.16em] text-slate-500">Chat</p>
                  <p className="mt-1 break-all text-slate-100">{developerApi?.chatCompletionsUrl || "--"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2">
                  <p className="uppercase tracking-[0.16em] text-slate-500">Models</p>
                  <p className="mt-1 break-all text-slate-100">{developerApi?.modelsUrl || "--"}</p>
                </div>
              </div>
              <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-xs leading-5 text-cyan-100">
                {developerApi?.curlExample || "curl ..."}
              </pre>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em] text-slate-300">
                {(developerApi?.tokenAccountingFields || ["usage.totalTokens"]).map((field) => (
                  <span key={field} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                    {field}
                  </span>
                ))}
                {(developerApi?.latencyFields || ["latencyMs"]).map((field) => (
                  <span key={field} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-100">
                    {field}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-black/25 p-4">
              <p className="text-sm font-semibold text-white">Save Profile</p>
              <div className="mt-3 space-y-3">
                <input value={profileDraft.id} onChange={(event) => setProfileDraft((current) => ({ ...current, id: event.target.value }))} placeholder="profile-id" className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm outline-none" />
                <input value={profileDraft.label} onChange={(event) => setProfileDraft((current) => ({ ...current, label: event.target.value }))} placeholder="Profile label" className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm outline-none" />
                <input value={profileDraft.targetId} onChange={(event) => setProfileDraft((current) => ({ ...current, targetId: event.target.value }))} placeholder="target id" className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm outline-none" />
                <textarea value={profileDraft.description} onChange={(event) => setProfileDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Description" rows={3} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm outline-none" />
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Temperature
                    <input type="number" step="0.05" value={profileDraft.temperature} onChange={(event) => setProfileDraft((current) => ({ ...current, temperature: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none" />
                  </label>
                  <label className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Context
                    <input type="number" step="1024" value={profileDraft.contextWindow} onChange={(event) => setProfileDraft((current) => ({ ...current, contextWindow: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none" />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
                  <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
                    <input type="checkbox" checked={profileDraft.enableTools} onChange={(event) => setProfileDraft((current) => ({ ...current, enableTools: event.target.checked }))} />
                    Tools
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
                    <input type="checkbox" checked={profileDraft.enableRetrieval} onChange={(event) => setProfileDraft((current) => ({ ...current, enableRetrieval: event.target.checked }))} />
                    RAG
                  </label>
                </div>
                <button type="button" onClick={() => void saveProfile()} disabled={pending === "save-profile"} className="w-full rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/15 disabled:opacity-60">
                  {pending === "save-profile" ? "Saving..." : "Save to registry"}
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">Local Server Request Logs</p>
                <button type="button" onClick={() => { setDrawerOpen(true); void loadLogs(); }} className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-50 hover:bg-emerald-400/15">
                  Open drawer
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2">
                  <p className="text-lg font-semibold text-white">{logs?.total || 0}</p>
                  <p className="uppercase tracking-[0.16em] text-slate-500">Requests</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2">
                  <p className="text-lg font-semibold text-white">{formatNumber(logs?.avgLatencyMs, " ms")}</p>
                  <p className="uppercase tracking-[0.16em] text-slate-500">Avg latency</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2">
                  <p className="text-lg font-semibold text-white">{logs?.totalTokens || 0}</p>
                  <p className="uppercase tracking-[0.16em] text-slate-500">Tokens</p>
                </div>
              </div>
              <p className="mt-3 break-all text-xs text-slate-500">{paths?.chatHistoryFile || "chat-history.jsonl"}</p>
            </section>

            <section className="rounded-3xl border border-white/10 bg-black/25 p-4">
              <p className="text-sm font-semibold text-white">Idle-unload Daemon Config</p>
              {idleConfig ? (
                <div className="mt-3 space-y-3">
                  <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-slate-300">
                    Enabled
                    <input type="checkbox" checked={idleConfig.enabled} onChange={(event) => setIdleConfig((current) => current ? { ...current, enabled: event.target.checked } : current)} />
                  </label>
                  <label className="block text-xs uppercase tracking-[0.16em] text-slate-500">
                    Idle minutes
                    <input type="number" value={idleConfig.idleMinutes} onChange={(event) => setIdleConfig((current) => current ? { ...current, idleMinutes: Number(event.target.value) } : current)} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none" />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-slate-300">
                    Release on memory pressure
                    <input type="checkbox" checked={idleConfig.memoryPressureRelease} onChange={(event) => setIdleConfig((current) => current ? { ...current, memoryPressureRelease: event.target.checked } : current)} />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-slate-300">
                    Preserve adapters
                    <input type="checkbox" checked={idleConfig.preserveAdapters} onChange={(event) => setIdleConfig((current) => current ? { ...current, preserveAdapters: event.target.checked } : current)} />
                  </label>
                  <p className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">
                    Current apply mode: {idleConfig.applyMode}. The config is persisted now; gateway daemon consumption should be wired after dataless source files are restored.
                  </p>
                  <button type="button" onClick={() => void saveIdleConfig()} disabled={pending === "save-idle"} className="w-full rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/15 disabled:opacity-60">
                    {pending === "save-idle" ? "Saving..." : "Save idle config"}
                  </button>
                  <p className="break-all text-xs text-slate-500">{paths?.idleUnloadConfigFile || "local-server-idle-unload.json"}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Loading idle-unload config...</p>
              )}
            </section>
          </aside>
        </div>
      </section>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <aside className="h-full w-full max-w-4xl overflow-auto border-l border-white/10 bg-slate-950 p-5 shadow-[-28px_0_90px_rgba(2,8,23,0.65)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-300">REQUEST LOG DRAWER</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Local Server requests</h2>
                <p className="mt-1 text-sm text-slate-400">{paths?.chatHistoryFile || "chat-history.jsonl"}</p>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10">
                Close
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {logs?.entries.length ? logs.entries.map((entry) => (
                <article key={entry.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{entry.targetLabel || entry.targetId}</p>
                      <p className="mt-1 text-xs text-slate-400">{entry.resolvedModel} · {formatDate(entry.completedAt)}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${entry.ok ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "border-rose-300/20 bg-rose-400/10 text-rose-100"}`}>
                      {entry.ok ? "ok" : "failed"}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-4">
                    <span className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">Latency {formatNumber(entry.latencyMs, " ms")}</span>
                    <span className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">First token {formatNumber(entry.firstTokenLatencyMs, " ms")}</span>
                    <span className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">TPS {formatNumber(entry.tokenThroughputTps)}</span>
                    <span className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">Tokens {entry.usage?.totalTokens || 0}</span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-300">{entry.inputPreview || "--"}</pre>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-300">{entry.outputPreview || entry.warning || "--"}</pre>
                  </div>
                </article>
              )) : (
                <p className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 text-sm text-slate-400">
                  No local server request logs yet.
                </p>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
