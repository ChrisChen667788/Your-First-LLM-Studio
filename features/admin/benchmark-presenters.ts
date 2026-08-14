export function getDefaultAdminBenchmarkTargetIds(targetIds: string[]) {
  const preferred = ["local-qwen3-0.6b", "local-qwen35-4b-4bit"].filter(
    (id) => targetIds.includes(id),
  );
  return preferred.length ? preferred : targetIds;
}

export function summarizeAdminBenchmarkRunNote(
  value: string,
  maxLength = 220,
) {
  const normalized = value
    .split("\n")
    .map((line) => line.replace(/^[#>\-\*\d\.\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
