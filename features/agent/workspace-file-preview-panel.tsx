"use client";

import type { FocusedFileExcerpt } from "@/features/compare/review";

export type AgentWorkspaceFileView = {
  path: string;
  absolutePath?: string;
  content?: string;
  truncated?: boolean;
  loading: boolean;
  error?: string;
};

export type AgentWorkspaceFileFocusState = {
  path: string;
  anchors: number[];
  index: number;
};

type WorkspaceFilePreviewPanelProps = {
  locale: string;
  reviewFileKey: string;
  openedFile?: AgentWorkspaceFileView;
  focusLine: number | null;
  focusedExcerpt: FocusedFileExcerpt | null;
  focusState: AgentWorkspaceFileFocusState | null;
  copyState: string;
  copiedLabel: string;
  onCopy: (content: string, key: string) => void;
  onStepAnchor: (direction: -1 | 1) => void;
};

export function WorkspaceFilePreviewPanel({
  locale,
  reviewFileKey,
  openedFile,
  focusLine,
  focusedExcerpt,
  focusState,
  copyState,
  copiedLabel,
  onCopy,
  onStepAnchor,
}: WorkspaceFilePreviewPanelProps) {
  const isEnglish = locale.startsWith("en");
  const hasFocusAnchors = Boolean(focusState?.anchors.length);

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
          {isEnglish ? "Workspace file" : "工作区文件"}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {hasFocusAnchors && focusState ? (
            <>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                {focusState.index + 1}/{focusState.anchors.length}
              </span>
              {focusedExcerpt ? (
                <button
                  type="button"
                  onClick={() =>
                    onCopy(focusedExcerpt.content, `${reviewFileKey}:segment`)
                  }
                  className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-violet-100 transition hover:bg-violet-400/20"
                >
                  {copyState === `${reviewFileKey}:segment`
                    ? copiedLabel
                    : isEnglish
                      ? "Copy current hunk"
                      : "复制当前变更段"}
                </button>
              ) : null}
              <button
                type="button"
                disabled={focusState.index === 0}
                onClick={() => onStepAnchor(-1)}
                className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isEnglish ? "Prev change" : "上一处变更"}
              </button>
              <button
                type="button"
                disabled={focusState.index >= focusState.anchors.length - 1}
                onClick={() => onStepAnchor(1)}
                className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isEnglish ? "Next change" : "下一处变更"}
              </button>
            </>
          ) : null}
          {openedFile?.absolutePath ? (
            <span className="text-[11px] text-slate-500">
              {openedFile.absolutePath}
            </span>
          ) : null}
        </div>
      </div>
      {openedFile?.loading ? (
        <p className="mt-2 text-xs leading-6 text-slate-400">
          {isEnglish ? "Loading file..." : "正在读取文件..."}
        </p>
      ) : openedFile?.error ? (
        <p className="mt-2 text-xs leading-6 text-rose-100">
          {openedFile.error}
        </p>
      ) : (
        <>
          {focusedExcerpt ? (
            <p className="mt-2 text-[11px] text-violet-200">
              {isEnglish
                ? `Focused near line ${focusLine}`
                : `已定位到第 ${focusLine} 行附近`}
            </p>
          ) : null}
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-200">
            {focusedExcerpt?.content || openedFile?.content || ""}
          </pre>
          {openedFile?.truncated ? (
            <p className="mt-2 text-[11px] text-amber-100">
              {isEnglish
                ? "Preview truncated to keep the trace panel responsive."
                : "为保持轨迹面板响应速度，文件预览已截断。"}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
