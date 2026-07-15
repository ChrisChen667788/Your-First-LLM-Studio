import { existsSync, readFileSync, statSync } from "fs";
import path from "path";

const MAX_FILE_PREVIEW_CHARS = 12000;

export class WorkspaceFileApplicationError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export function readAgentWorkspaceFile(inputPath?: string | null) {
  const normalizedPath = inputPath?.trim();
  if (!normalizedPath) throw new WorkspaceFileApplicationError("path is required.");
  const workspaceRoot = process.cwd();
  const resolvedPath = path.isAbsolute(normalizedPath)
    ? path.resolve(normalizedPath)
    : path.resolve(workspaceRoot, normalizedPath);
  const relativePath = path.relative(workspaceRoot, resolvedPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new WorkspaceFileApplicationError("Path escapes the current workspace.");
  }
  if (!existsSync(resolvedPath)) {
    throw new WorkspaceFileApplicationError("File not found.", 404);
  }
  const stats = statSync(resolvedPath);
  if (!stats.isFile()) {
    throw new WorkspaceFileApplicationError("Only files can be opened.");
  }
  const source = readFileSync(resolvedPath, "utf8");
  const truncated = source.length > MAX_FILE_PREVIEW_CHARS;
  return {
    ok: true,
    workspaceRoot,
    path: relativePath,
    absolutePath: resolvedPath,
    truncated,
    content: truncated ? `${source.slice(0, MAX_FILE_PREVIEW_CHARS)}\n…` : source,
  };
}
