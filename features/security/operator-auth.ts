import { createHash, timingSafeEqual } from "node:crypto";

export class OperatorAuthorizationError extends Error {
  readonly status = 401;

  constructor(message: string) {
    super(message);
    this.name = "OperatorAuthorizationError";
  }
}

function isLoopbackHost(value: string) {
  const host = value.trim().toLowerCase();
  if (host === "::1" || host === "[::1]") return true;
  if (host.startsWith("[")) {
    const closingBracket = host.indexOf("]");
    return closingBracket > 0 && host.slice(1, closingBracket) === "::1";
  }
  const hostname = host.replace(/:\d+$/u, "");
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function tokenMatches(received: string, expected: string) {
  const left = createHash("sha256").update(received).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
}

export function assertTrustedOperatorRequest(request: Request) {
  const expectedToken = process.env.FIRST_LLM_OPERATOR_TOKEN?.trim() || "";
  const receivedToken = bearerToken(request) || request.headers.get("x-first-llm-operator-key")?.trim() || "";
  if (expectedToken) {
    if (receivedToken && tokenMatches(receivedToken, expectedToken)) return { mode: "operator-token" as const };
    throw new OperatorAuthorizationError("A valid FIRST_LLM_OPERATOR_TOKEN is required for this control-plane mutation.");
  }

  const bindHost = process.env.FIRST_LLM_WEB_HOST?.trim() || "127.0.0.1";
  const requestHost = new URL(request.url).hostname;
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  if (!isLoopbackHost(bindHost) || !isLoopbackHost(requestHost) || (forwardedFor && !isLoopbackHost(forwardedFor))) {
    throw new OperatorAuthorizationError("Remote control-plane mutations require FIRST_LLM_OPERATOR_TOKEN.");
  }
  return { mode: "bound-loopback" as const };
}

export function operatorAuthorizationStatus(error: unknown) {
  return error instanceof OperatorAuthorizationError ? error.status : 400;
}
