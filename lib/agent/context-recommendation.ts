export const VALIDATED_LOCAL_CONTEXT_WINDOW = 32768;

export function formatContextWindowShort(value: number) {
  return value >= 1024 ? `${Math.round(value / 1024)}K` : `${value}`;
}

export function getBenchmarkContextRecommendationHelper(
  locale: string,
  contextWindow = VALIDATED_LOCAL_CONTEXT_WINDOW,
) {
  const label = formatContextWindowShort(contextWindow);
  if (locale === "zh-TW") {
    return `推薦本地預設：${label} 上下文（已驗證）`;
  }
  if (locale === "ja") {
    return `推奨ローカル既定値: ${label} コンテキスト（検証済み）`;
  }
  if (locale === "ko") {
    return `권장 로컬 기본값: ${label} 컨텍스트(검증됨)`;
  }
  if (locale.startsWith("en")) {
    return `Recommended local default: ${label} context (validated)`;
  }
  return `推荐本地默认：${label} 上下文（已验证）`;
}

export function getCompareContextValidatedHelper(
  locale: string,
  contextWindow = VALIDATED_LOCAL_CONTEXT_WINDOW,
) {
  const label = formatContextWindowShort(contextWindow);
  if (locale === "zh-TW") {
    return `✓ ${label} 上下文已驗證`;
  }
  if (locale === "ja") {
    return `✓ ${label} コンテキスト検証済み`;
  }
  if (locale === "ko") {
    return `✓ ${label} 컨텍스트 검증됨`;
  }
  if (locale.startsWith("en")) {
    return `✓ ${label} context validated`;
  }
  return `✓ ${label} 上下文已验证`;
}
