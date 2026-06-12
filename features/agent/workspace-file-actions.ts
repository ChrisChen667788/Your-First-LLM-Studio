"use client";

import { useCallback, useState } from "react";
import type {
  AgentWorkspaceFileFocusState,
  AgentWorkspaceFileView,
} from "./workspace-file-preview-panel";

export type OpenAgentWorkspaceFileOptions = {
  focusDiff?: boolean;
  anchors?: number[];
  anchorIndex?: number;
};

type AgentWorkspaceFilePayload = {
  error?: string;
  path?: string;
  absolutePath?: string;
  content?: string;
  truncated?: boolean;
};

export function useAgentWorkspaceFileActions() {
  const [openWorkspaceFilePath, setOpenWorkspaceFilePath] = useState("");
  const [focusedWorkspaceFilePath, setFocusedWorkspaceFilePath] = useState("");
  const [workspaceFileFocusState, setWorkspaceFileFocusState] =
    useState<AgentWorkspaceFileFocusState | null>(null);
  const [workspaceFileViews, setWorkspaceFileViews] = useState<
    Record<string, AgentWorkspaceFileView>
  >({});

  const handleStepWorkspaceFileAnchor = useCallback((direction: -1 | 1) => {
    setWorkspaceFileFocusState((current) => {
      if (!current || current.anchors.length <= 1) return current;
      const nextIndex = current.index + direction;
      if (nextIndex < 0 || nextIndex >= current.anchors.length) return current;
      return {
        ...current,
        index: nextIndex,
      };
    });
  }, []);

  const handleOpenWorkspaceFile = useCallback(
    async (
      relativePath: string,
      options?: OpenAgentWorkspaceFileOptions,
    ) => {
      if (!relativePath) return;

      const nextOpenPath =
        openWorkspaceFilePath === relativePath ? "" : relativePath;
      setOpenWorkspaceFilePath(nextOpenPath);
      setFocusedWorkspaceFilePath(
        nextOpenPath && options?.focusDiff ? relativePath : "",
      );
      setWorkspaceFileFocusState(
        nextOpenPath && options?.focusDiff
          ? {
              path: relativePath,
              anchors: options?.anchors?.length ? options.anchors : [1],
              index: Math.max(
                0,
                Math.min(
                  options?.anchorIndex ?? 0,
                  Math.max((options?.anchors?.length || 1) - 1, 0),
                ),
              ),
            }
          : null,
      );

      const cached = workspaceFileViews[relativePath];
      if (!nextOpenPath || cached?.content || cached?.loading) return;

      setWorkspaceFileViews((current) => ({
        ...current,
        [relativePath]: {
          path: relativePath,
          loading: true,
        },
      }));

      try {
        const response = await fetch(
          `/api/agent/workspace-file?path=${encodeURIComponent(relativePath)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as AgentWorkspaceFilePayload;
        if (!response.ok) {
          throw new Error(payload.error || "Failed to open workspace file.");
        }
        setWorkspaceFileViews((current) => ({
          ...current,
          [relativePath]: {
            path: payload.path || relativePath,
            absolutePath: payload.absolutePath,
            content: payload.content || "",
            truncated: Boolean(payload.truncated),
            loading: false,
          },
        }));
      } catch (workspaceFileError) {
        setWorkspaceFileViews((current) => ({
          ...current,
          [relativePath]: {
            path: relativePath,
            loading: false,
            error:
              workspaceFileError instanceof Error
                ? workspaceFileError.message
                : "Failed to open workspace file.",
          },
        }));
      }
    },
    [openWorkspaceFilePath, workspaceFileViews],
  );

  return {
    openWorkspaceFilePath,
    focusedWorkspaceFilePath,
    workspaceFileFocusState,
    workspaceFileViews,
    handleStepWorkspaceFileAnchor,
    handleOpenWorkspaceFile,
  };
}
