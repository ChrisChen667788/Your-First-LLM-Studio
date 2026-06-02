export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableRemoteBenchmarkFailure(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("已达到最大并发数") ||
    normalized.includes("max concurrent") ||
    normalized.includes("rate limit") ||
    normalized.includes("429") ||
    normalized.includes("timed out") ||
    normalized.includes("timeout") ||
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("socket hang up") ||
    normalized.includes("aborted") ||
    normalized.includes("terminated") ||
    normalized.includes("stream idle timeout") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("bad gateway") ||
    normalized.includes("service unavailable")
  );
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal,
) {
  const controller = new AbortController();
  const abortFromExternal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", abortFromExternal, { once: true });
    }
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", abortFromExternal);
    }
  }
}

export async function readNdjsonStream(
  response: Response,
  onObject: (value: Record<string, unknown>) => void | Promise<void>,
) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Upstream stream body is missing.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let lineBreak = buffer.indexOf("\n");
    while (lineBreak !== -1) {
      const line = buffer.slice(0, lineBreak).trim();
      buffer = buffer.slice(lineBreak + 1);
      if (line) {
        await onObject(JSON.parse(line) as Record<string, unknown>);
      }
      lineBreak = buffer.indexOf("\n");
    }
  }

  const tail = buffer.trim();
  if (tail) {
    await onObject(JSON.parse(tail) as Record<string, unknown>);
  }
}
