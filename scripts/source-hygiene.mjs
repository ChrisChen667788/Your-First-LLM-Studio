import { readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SOURCE_DIRS = ["app", "components", "features", "lib", "pages", "scripts"];
const SOURCE_EXTENSIONS = new Set([
  ".css",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
]);
const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".next-dev",
  ".next-build",
  "dist",
  "output",
  ".codex-run",
]);
const CONFLICT_MARKERS = ["<<<<<<< ", "=======", ">>>>>>> "];
const SOURCE_READ_TIMEOUT_MS = Number.parseInt(
  process.env.SOURCE_HYGIENE_READ_TIMEOUT_MS || "5000",
  10,
);

if (!Number.isFinite(SOURCE_READ_TIMEOUT_MS) || SOURCE_READ_TIMEOUT_MS <= 0) {
  console.error("[lint] SOURCE_HYGIENE_READ_TIMEOUT_MS must be a positive integer.");
  process.exit(2);
}

function hasSourceExtension(path) {
  return [...SOURCE_EXTENSIONS].some((extension) => path.endsWith(extension));
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".next") || IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (entry.isFile() && hasSourceExtension(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = SOURCE_DIRS.flatMap((dir) => {
  const fullPath = join(ROOT, dir);
  try {
    if (!statSync(fullPath).isDirectory()) return [];
  } catch {
    return [];
  }
  return walk(fullPath);
});

const issues = [];
for (const file of files) {
  let content;
  try {
    content = await readFile(file, {
      encoding: "utf8",
      signal: AbortSignal.timeout(SOURCE_READ_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error?.code || error?.name || "read failed";
    issues.push(`${relative(ROOT, file)} unreadable source (${reason})`);
    continue;
  }
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/\s+$/.test(line)) {
      issues.push(`${relative(ROOT, file)}:${index + 1} trailing whitespace`);
    }
    if (CONFLICT_MARKERS.some((marker) => line.startsWith(marker))) {
      issues.push(`${relative(ROOT, file)}:${index + 1} merge conflict marker`);
    }
  });
}

if (issues.length) {
  console.error(`[lint] source hygiene failed with ${issues.length} issue(s):`);
  for (const issue of issues.slice(0, 80)) console.error(`- ${issue}`);
  if (issues.length > 80) console.error(`- ... ${issues.length - 80} more`);
  process.exit(1);
}

console.log(`[lint] source hygiene passed for ${files.length} files.`);
