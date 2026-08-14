import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("enterprise IdP adapter probes OIDC/JWKS and synchronizes paged SCIM resources", async () => {
  const dataDirectory = mkdtempSync(
    path.join(os.tmpdir(), "first-llm-enterprise-idp-test-"),
  );
  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = publicKey.export({ format: "jwk" });
  Object.assign(jwk, { kid: "test-key-1", alg: "RS256", use: "sig" });
  let issuer = "";
  const server = createServer((request, response) => {
    const url = new URL(request.url || "/", issuer);
    const authorized = request.headers.authorization === "Bearer scim-provider-test";
    let payload: Record<string, unknown> | null = null;
    if (url.pathname === "/.well-known/openid-configuration") {
      payload = {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
      };
    } else if (url.pathname === "/jwks") {
      payload = { keys: [jwk] };
    } else if (!authorized) {
      response.writeHead(401).end();
      return;
    } else if (url.pathname === "/scim/v2/ServiceProviderConfig") {
      payload = {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
        patch: { supported: true },
      };
    } else if (url.pathname === "/scim/v2/Users") {
      payload = {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
        totalResults: 1,
        startIndex: 1,
        itemsPerPage: 1,
        Resources: [{ id: "user-1", userName: "operator@example.test", active: true }],
      };
    } else if (url.pathname === "/scim/v2/Groups") {
      payload = {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
        totalResults: 1,
        startIndex: 1,
        itemsPerPage: 1,
        Resources: [{
          id: "group-1",
          displayName: "LLM Operators",
          members: [{ value: "user-1", display: "operator@example.test" }],
        }],
      };
    }
    if (!payload) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(payload));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test IdP did not bind a port.");
  issuer = `http://127.0.0.1:${address.port}`;
  process.env.LOCAL_AGENT_DATA_DIR = dataDirectory;
  process.env.FIRST_LLM_OIDC_ISSUER = issuer;
  process.env.FIRST_LLM_OIDC_CLIENT_ID = "first-llm-test";
  process.env.FIRST_LLM_SCIM_PROVIDER_BASE_URL = `${issuer}/scim/v2`;
  process.env.FIRST_LLM_SCIM_PROVIDER_TOKEN = "scim-provider-test";
  try {
    const adapter = await import("@/features/governance/enterprise-idp-adapter");
    const provisioning = await import("@/features/governance/identity-provisioning");
    const receipt = await adapter.runEnterpriseIdpAdapter({ sync: true });
    assert.equal(receipt.status, "pass");
    assert.equal(receipt.productionStatus, "hold");
    assert.equal(receipt.scim.users, 1);
    assert.equal(receipt.scim.groups, 1);
    assert.deepEqual(receipt.provider.oidcKeyIds, ["test-key-1"]);
    const directory = provisioning.readScimDirectorySnapshot();
    assert.equal(directory.users[0].userName, "operator@example.test");
    assert.equal(directory.groups[0].members[0].value, "user-1");
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
    rmSync(dataDirectory, { recursive: true, force: true });
  }
});
