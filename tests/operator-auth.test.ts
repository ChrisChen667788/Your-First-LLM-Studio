import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTrustedOperatorRequest,
  OperatorAuthorizationError,
} from "@/features/security/operator-auth";

const originalToken = process.env.FIRST_LLM_OPERATOR_TOKEN;
const originalHost = process.env.FIRST_LLM_WEB_HOST;

test.afterEach(() => {
  if (originalToken === undefined) delete process.env.FIRST_LLM_OPERATOR_TOKEN;
  else process.env.FIRST_LLM_OPERATOR_TOKEN = originalToken;
  if (originalHost === undefined) delete process.env.FIRST_LLM_WEB_HOST;
  else process.env.FIRST_LLM_WEB_HOST = originalHost;
});

test("loopback-bound control plane permits local mutation without a token", () => {
  delete process.env.FIRST_LLM_OPERATOR_TOKEN;
  process.env.FIRST_LLM_WEB_HOST = "127.0.0.1";
  assert.equal(assertTrustedOperatorRequest(new Request("http://127.0.0.1:3011/api/workflows")).mode, "bound-loopback");
  assert.equal(assertTrustedOperatorRequest(new Request("http://[::1]:3011/api/workflows")).mode, "bound-loopback");
});

test("remote or forwarded control-plane mutation fails closed without a token", () => {
  delete process.env.FIRST_LLM_OPERATOR_TOKEN;
  process.env.FIRST_LLM_WEB_HOST = "0.0.0.0";
  assert.throws(
    () => assertTrustedOperatorRequest(new Request("https://studio.example.com/api/workflows")),
    OperatorAuthorizationError,
  );
  process.env.FIRST_LLM_WEB_HOST = "127.0.0.1";
  assert.throws(
    () => assertTrustedOperatorRequest(new Request("http://127.0.0.1:3011/api/workflows", { headers: { "x-forwarded-for": "203.0.113.10" } })),
    OperatorAuthorizationError,
  );
});

test("configured operator token is required even on loopback", () => {
  process.env.FIRST_LLM_OPERATOR_TOKEN = "operator-secret";
  process.env.FIRST_LLM_WEB_HOST = "127.0.0.1";
  const url = "http://127.0.0.1:3011/api/workflows";
  assert.throws(() => assertTrustedOperatorRequest(new Request(url)), OperatorAuthorizationError);
  assert.equal(
    assertTrustedOperatorRequest(new Request(url, { headers: { authorization: "Bearer operator-secret" } })).mode,
    "operator-token",
  );
});
