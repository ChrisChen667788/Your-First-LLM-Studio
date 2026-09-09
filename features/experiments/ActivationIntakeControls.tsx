"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { createActivationIntakeService } from "@/features/evidence/activation-intake/service";

type Summary = ReturnType<ReturnType<typeof createActivationIntakeService>["summary"]>;
const endpoint = "/api/experiments/activation-intake";
const button = "rounded-md border border-white/20 px-3 py-2 text-xs text-slate-100 hover:bg-white/10 disabled:opacity-40";

export function ActivationIntakeControls({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [mode, setMode] = useState<"import" | "restore" | "register-manifest">("import");
  const [input, setInput] = useState<unknown>(null);
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const load = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Evidence intake unavailable.");
    if (mounted.current) setSummary(data);
  }, []);
  useEffect(() => {
    mounted.current = true;
    void load().catch((err: Error) => { if (mounted.current) setError(err.message); });
    return () => { mounted.current = false; };
  }, [load]);
  async function run(dryRun = false) {
    if (!summary || input === null) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const body = mode === "import" ? { action: mode, expectedRevision: summary.revision, dryRun, envelopes: input }
        : mode === "restore" ? { action: mode, expectedRevision: summary.revision, backup: input } : { action: mode, manifest: input };
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || data.code || "Import rejected.");
      setMessage(dryRun ? (en ? `Preview: ${data.added} new, ${data.deduplicated} duplicate.` : `预检：新增 ${data.added}，重复 ${data.deduplicated}。`)
        : en ? "Saved." : "已保存。");
    } catch (err) { setError(err instanceof Error ? err.message : "Import failed."); }
    finally { await load().catch((err: Error) => setError(err.message)); setBusy(false); }
  }
  async function exportBackup() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${endpoint}?export=true`);
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Export rejected."); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = "activation-intake-backup.json"; link.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err instanceof Error ? err.message : "Export failed."); }
    finally { setBusy(false); }
  }
  return (
    <div id="activation-intake" className="min-w-0 scroll-mt-40 border-b border-white/10 px-5 py-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-100">{en ? "Signed evidence inbox" : "签名证据收件箱"}</h3>
        <span className={`text-xs ${summary?.configured ? "text-emerald-200" : "text-amber-200"}`}>
          {summary ? summary.configured ? (en ? "Trust configured" : "已配置受信公钥") : (en ? "Trust configuration required" : "待配置受信公钥") : (en ? "Loading" : "读取中")}
        </span>
      </div>
      <dl className="my-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        {[[en ? "Revision" : "修订号", summary?.revision], [en ? "Signed records" : "签名记录", summary?.records], [en ? "Current records" : "当前有效", summary?.currentRecords], [en ? "Open quarantine" : "待处理隔离", summary?.openQuarantines]].map(([label, value]) => <div key={label}><dt className="text-slate-400">{label}</dt><dd className="mt-1 text-base font-semibold text-slate-100">{value ?? "--"}</dd></div>)}
      </dl>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <label className="text-xs text-slate-300">{en ? "Operation" : "操作"}
          <select aria-label={en ? "Evidence operation" : "证据操作"} value={mode} disabled={busy} onChange={(event) => { setMode(event.target.value as typeof mode); setMessage(""); }} className="ml-2 rounded-md border border-white/20 bg-[#10151f] p-2">
            <option value="import">{en ? "Import evidence" : "导入证据"}</option><option value="restore">{en ? "Merge backup" : "合并备份"}</option><option value="register-manifest">{en ? "Register manifest" : "登记清单"}</option>
          </select>
        </label>
        <label className={`${button} max-w-full cursor-pointer break-all`}>
          {filename || (en ? "Choose JSON" : "选择 JSON")}
          <input aria-label={en ? "Evidence JSON file" : "证据 JSON 文件"} className="sr-only" type="file" accept="application/json,.json" disabled={busy} onChange={async (event) => {
            const file = event.target.files?.[0]; setInput(null); setFilename(""); setError(""); setMessage("");
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) { setError(en ? "File exceeds 2 MiB." : "文件超过 2 MiB。"); return; }
            try { const parsed: unknown = JSON.parse(await file.text()); setInput(parsed); setFilename(file.name); } catch { setError(en ? "Invalid JSON." : "JSON 格式无效。"); }
          }} />
        </label>
        {mode === "import" ? <button type="button" className={button} disabled={busy || !summary?.configured || input === null} onClick={() => void run(true)}>{en ? "Preview" : "预检"}</button> : null}
        <button type="button" className={button} disabled={busy || !summary?.configured || input === null} onClick={() => void run()}>{en ? "Apply" : "应用"}</button>
        <button type="button" className={button} disabled={busy || !summary?.configured} onClick={() => void exportBackup()}>{en ? "Export backup" : "导出备份"}</button>
        <button type="button" className={button} disabled={busy} onClick={() => { setBusy(true); void load().catch((err: Error) => setError(err.message)).finally(() => setBusy(false)); }}>{en ? "Refresh" : "刷新"}</button>
      </div>
      {error ? <p role="alert" className="mt-3 break-words text-xs text-rose-200">{error}</p> : null}
      {message ? <p role="status" className="mt-3 text-xs text-emerald-200">{message}</p> : null}
    </div>
  );
}
