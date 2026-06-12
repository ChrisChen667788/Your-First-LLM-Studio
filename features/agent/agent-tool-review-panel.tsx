"use client";

import type { FocusedFileExcerpt, ToolReviewItem } from "@/features/compare/review";
import {
  buildFocusedFileExcerpt,
  readNewFileLineAnchorsFromDiff,
} from "@/features/compare/review";
import type { OpenAgentWorkspaceFileOptions } from "./workspace-file-actions";
import {
  WorkspaceFilePreviewPanel,
  type AgentWorkspaceFileFocusState,
  type AgentWorkspaceFileView,
} from "./workspace-file-preview-panel";

type AgentToolReviewPanelProps = {
  locale: string;
  reviewItems: ToolReviewItem[];
  expandedReviewFileKey: string;
  workspaceFileViews: Record<string, AgentWorkspaceFileView>;
  openWorkspaceFilePath: string;
  focusedWorkspaceFilePath: string;
  workspaceFileFocusState: AgentWorkspaceFileFocusState | null;
  copyState: string;
  copiedLabel: string;
  onCopy: (content: string, key: string) => void;
  onToggleReviewFile: (reviewFileKey: string) => void;
  onOpenWorkspaceFile: (
    relativePath: string,
    options?: OpenAgentWorkspaceFileOptions,
  ) => void | Promise<void>;
  onStepWorkspaceFileAnchor: (direction: -1 | 1) => void;
};

type ReviewFile = ToolReviewItem["files"][number];

type ReviewFileCardProps = Omit<AgentToolReviewPanelProps, "reviewItems"> & {
  itemKey: string;
  file: ReviewFile;
};

function ReviewFileCard({
  locale,
  itemKey,
  file,
  expandedReviewFileKey,
  workspaceFileViews,
  openWorkspaceFilePath,
  focusedWorkspaceFilePath,
  workspaceFileFocusState,
  copyState,
  copiedLabel,
  onCopy,
  onToggleReviewFile,
  onOpenWorkspaceFile,
  onStepWorkspaceFileAnchor,
}: ReviewFileCardProps) {
  const isEnglish = locale.startsWith("en");
  const reviewFileKey = `${itemKey}:${file.path}`;
  const open = expandedReviewFileKey === reviewFileKey;
  const openedFile = workspaceFileViews[file.path];
  const workspaceFileOpen = openWorkspaceFilePath === file.path;
  const focusAnchors = file.diffPreview
    ? readNewFileLineAnchorsFromDiff(file.diffPreview)
    : [];
  const focusLine =
    workspaceFileOpen &&
    workspaceFileFocusState?.path === file.path &&
    workspaceFileFocusState.anchors.length
      ? workspaceFileFocusState.anchors[workspaceFileFocusState.index]
      : focusAnchors[0] || null;
  const focusedExcerpt: FocusedFileExcerpt | null =
    workspaceFileOpen &&
    focusedWorkspaceFilePath === file.path &&
    focusLine &&
    openedFile?.content
      ? buildFocusedFileExcerpt(openedFile.content, focusLine)
      : null;

  return (
    <div className="rounded-xl border border-white/10 bg-black/20">
      <button
        type="button"
        onClick={() => onToggleReviewFile(reviewFileKey)}
        className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-white">{file.path}</span>
          {file.changed !== null ? (
            <span
              className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
                file.changed
                  ? "bg-emerald-400/10 text-emerald-200"
                  : "bg-white/5 text-slate-300"
              }`}
            >
              {file.changed
                ? isEnglish
                  ? "Changed"
                  : "已变更"
                : isEnglish
                  ? "No diff"
                  : "无差异"}
            </span>
          ) : null}
          {file.existedBefore === false ? (
            <span className="rounded-full bg-cyan-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-200">
              {isEnglish ? "Created" : "新建"}
            </span>
          ) : null}
          {file.existsAfter === false ? (
            <span className="rounded-full bg-rose-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-rose-200">
              {isEnglish ? "Removed" : "已删除"}
            </span>
          ) : null}
        </div>
        <span className="text-[11px] text-slate-400">
          {open
            ? isEnglish
              ? "Collapse"
              : "收起"
            : isEnglish
              ? "Expand"
              : "展开"}
        </span>
      </button>
      <div className="flex flex-wrap gap-2 px-3 pb-2">
        <button
          type="button"
          onClick={() =>
            onCopy(
              file.diffPreview || file.contentPreview || file.path,
              `${reviewFileKey}:file`,
            )
          }
          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200 transition hover:bg-white/10"
        >
          {copyState === `${reviewFileKey}:file`
            ? copiedLabel
            : isEnglish
              ? "Copy file diff"
              : "复制文件 diff"}
        </button>
        <button
          type="button"
          onClick={() => void onOpenWorkspaceFile(file.path)}
          className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-400/20"
        >
          {workspaceFileOpen
            ? isEnglish
              ? "Hide file"
              : "收起文件"
            : isEnglish
              ? "Open file"
              : "打开文件"}
        </button>
        {focusLine ? (
          <button
            type="button"
            onClick={() =>
              void onOpenWorkspaceFile(file.path, {
                focusDiff: true,
                anchors: focusAnchors,
                anchorIndex: 0,
              })
            }
            className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-violet-100 transition hover:bg-violet-400/20"
          >
            {isEnglish ? "Jump to diff" : "跳到 diff"}
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="border-t border-white/10 px-3 py-3">
          {file.diffPreview ? (
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-cyan-400/15 bg-cyan-400/5 px-3 py-3 text-xs leading-6 text-cyan-50">
              {file.diffPreview}
            </pre>
          ) : file.contentPreview ? (
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 text-xs leading-6 text-slate-200">
              {file.contentPreview}
            </pre>
          ) : (
            <p className="text-xs leading-6 text-slate-400">
              {isEnglish
                ? "No file-level preview available."
                : "当前没有文件级预览内容。"}
            </p>
          )}
          {workspaceFileOpen ? (
            <WorkspaceFilePreviewPanel
              locale={locale}
              reviewFileKey={reviewFileKey}
              openedFile={openedFile}
              focusLine={focusLine}
              focusedExcerpt={focusedExcerpt}
              focusState={
                workspaceFileFocusState?.path === file.path
                  ? workspaceFileFocusState
                  : null
              }
              copyState={copyState}
              copiedLabel={copiedLabel}
              onCopy={onCopy}
              onStepAnchor={onStepWorkspaceFileAnchor}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AgentToolReviewPanel({
  locale,
  reviewItems,
  expandedReviewFileKey,
  workspaceFileViews,
  openWorkspaceFilePath,
  focusedWorkspaceFilePath,
  workspaceFileFocusState,
  copyState,
  copiedLabel,
  onCopy,
  onToggleReviewFile,
  onOpenWorkspaceFile,
  onStepWorkspaceFileAnchor,
}: AgentToolReviewPanelProps) {
  if (!reviewItems.length) return null;
  const isEnglish = locale.startsWith("en");

  return (
    <div className="mt-3 space-y-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-sky-200">
        {isEnglish ? "Patch / diff review" : "Patch / Diff 审核"}
      </p>
      {reviewItems.map((item) => (
        <div
          key={item.key}
          className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-sky-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-sky-200">
              {item.toolName}
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
              {item.status}
            </span>
            {item.confirmationRequired ? (
              <span className="rounded-full bg-violet-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-violet-200">
                {isEnglish ? "Needs approval" : "待审批"}
              </span>
            ) : null}
            {item.confirmationUsed ? (
              <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-200">
                {isEnglish ? "Approved" : "已审批"}
              </span>
            ) : null}
            {item.verified !== null ? (
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${
                  item.verified
                    ? "bg-emerald-400/10 text-emerald-200"
                    : "bg-rose-400/10 text-rose-200"
                }`}
              >
                {item.verified
                  ? isEnglish
                    ? "Verified"
                    : "已验证"
                  : isEnglish
                    ? "Needs review"
                    : "待复核"}
              </span>
            ) : null}
          </div>
          {item.affectedFiles.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {item.affectedFiles.map((filePath) => (
                <span
                  key={filePath}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-slate-200"
                >
                  {filePath}
                </span>
              ))}
            </div>
          ) : null}
          {item.files.length ? (
            <div className="mt-3 space-y-2">
              {item.files.map((file) => (
                <ReviewFileCard
                  key={`${item.key}:${file.path}`}
                  locale={locale}
                  itemKey={item.key}
                  file={file}
                  expandedReviewFileKey={expandedReviewFileKey}
                  workspaceFileViews={workspaceFileViews}
                  openWorkspaceFilePath={openWorkspaceFilePath}
                  focusedWorkspaceFilePath={focusedWorkspaceFilePath}
                  workspaceFileFocusState={workspaceFileFocusState}
                  copyState={copyState}
                  copiedLabel={copiedLabel}
                  onCopy={onCopy}
                  onToggleReviewFile={onToggleReviewFile}
                  onOpenWorkspaceFile={onOpenWorkspaceFile}
                  onStepWorkspaceFileAnchor={onStepWorkspaceFileAnchor}
                />
              ))}
            </div>
          ) : null}
          {item.diffPreview ? (
            <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-cyan-400/15 bg-cyan-400/5 px-3 py-3 text-xs leading-6 text-cyan-50">
              {item.diffPreview}
            </pre>
          ) : item.contentPreview ? (
            <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs leading-6 text-slate-200">
              {item.contentPreview}
            </pre>
          ) : null}
          {item.errorText ? (
            <p className="mt-3 text-xs leading-6 text-rose-100">
              {item.errorText}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
