import { createPublicKey, randomUUID, timingSafeEqual, verify, type JsonWebKey as CryptoJsonWebKey } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

export const IDENTITY_PROVISIONING_SCHEMA_VERSION = "governance.identity-provisioning.v1" as const;

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const SCIM_FILE = path.join(DATA_DIR, "scim-directory.json");

type ScimUser = { id: string; userName: string; displayName?: string; active: boolean; externalId?: string; meta: { resourceType: "User"; created: string; lastModified: string } };
type ScimGroup = { id: string; displayName: string; members: Array<{ value: string; display?: string }>; meta: { resourceType: "Group"; created: string; lastModified: string } };

function readDirectory(): { users: ScimUser[]; groups: ScimGroup[] } {
  if (!existsSync(SCIM_FILE)) return { users: [], groups: [] };
  try {
    const parsed = JSON.parse(readFileSync(SCIM_FILE, "utf8")) as { users?: ScimUser[]; groups?: ScimGroup[] };
    return { users: Array.isArray(parsed.users) ? parsed.users : [], groups: Array.isArray(parsed.groups) ? parsed.groups : [] };
  } catch { return { users: [], groups: [] }; }
}

function writeDirectory(directory: { users: ScimUser[]; groups: ScimGroup[] }) {
  mkdirSync(path.dirname(SCIM_FILE), { recursive: true });
  writeFileSync(SCIM_FILE, `${JSON.stringify({ schemaVersion: "governance.scim-directory.v1", ...directory }, null, 2)}\n`, "utf8");
}

export function assertScimAuthorization(authorization: string | null) {
  const configured = process.env.FIRST_LLM_SCIM_BEARER_TOKEN || "";
  if (!configured) throw new Error("SCIM provisioning is disabled because FIRST_LLM_SCIM_BEARER_TOKEN is not configured.");
  const received = authorization?.replace(/^Bearer\s+/i, "") || "";
  const left = Buffer.from(configured); const right = Buffer.from(received);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error("SCIM bearer token is invalid.");
}

export function readIdentityProvisioningReadiness() {
  const issuer = process.env.FIRST_LLM_OIDC_ISSUER?.replace(/\/+$/, "") || "";
  const directory = readDirectory();
  return {
    ok: true as const,
    schemaVersion: IDENTITY_PROVISIONING_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    oidc: { configured: Boolean(issuer && process.env.FIRST_LLM_OIDC_CLIENT_ID), issuer: issuer || null, discoveryUrl: issuer ? `${issuer}/.well-known/openid-configuration` : null },
    scim: { configured: Boolean(process.env.FIRST_LLM_SCIM_BEARER_TOKEN), users: directory.users.length, groups: directory.groups.length, endpoint: "/api/scim/v2" },
    blockers: [
      ...(!issuer || !process.env.FIRST_LLM_OIDC_CLIENT_ID ? ["OIDC issuer/client are not configured."] : []),
      ...(!process.env.FIRST_LLM_SCIM_BEARER_TOKEN ? ["SCIM bearer token is not configured."] : []),
    ],
  };
}

export async function discoverOidcProvider() {
  const readiness = readIdentityProvisioningReadiness();
  if (!readiness.oidc.configured || !readiness.oidc.discoveryUrl) throw new Error("OIDC discovery is not configured.");
  const response = await fetch(readiness.oidc.discoveryUrl, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`OIDC discovery returned HTTP ${response.status}.`);
  const metadata = await response.json() as { issuer?: string; authorization_endpoint?: string; token_endpoint?: string; jwks_uri?: string };
  if (metadata.issuer?.replace(/\/+$/, "") !== readiness.oidc.issuer) throw new Error("OIDC discovery issuer does not match configuration.");
  if (!metadata.authorization_endpoint || !metadata.token_endpoint || !metadata.jwks_uri) throw new Error("OIDC discovery metadata is incomplete.");
  return { ok: true as const, issuer: metadata.issuer, endpoints: { authorization: metadata.authorization_endpoint, token: metadata.token_endpoint, jwks: metadata.jwks_uri } };
}

function decodeJwtPart(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
}

export async function verifyOidcIdToken(idToken: string, expectedNonce?: string) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("OIDC ID token must use compact JWS serialization.");
  const header = decodeJwtPart(parts[0]) as { alg?: string; kid?: string };
  const claims = decodeJwtPart(parts[1]) as { iss?: string; aud?: string | string[]; sub?: string; exp?: number; iat?: number; nonce?: string; email?: string; name?: string };
  if (header.alg !== "RS256" || !header.kid) throw new Error("Only RS256 ID tokens with kid are supported.");
  const discovery = await discoverOidcProvider();
  const response = await fetch(discovery.endpoints.jwks, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`OIDC JWKS returned HTTP ${response.status}.`);
  const jwks = await response.json() as { keys?: Array<CryptoJsonWebKey & { kid?: string; use?: string; alg?: string }> };
  const jwk = jwks.keys?.find((candidate) => candidate.kid === header.kid && (!candidate.use || candidate.use === "sig"));
  if (!jwk) throw new Error("OIDC signing key was not found in JWKS.");
  const validSignature = verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(parts[2], "base64url"));
  if (!validSignature) throw new Error("OIDC ID token signature is invalid.");
  const readiness = readIdentityProvisioningReadiness();
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const clientId = process.env.FIRST_LLM_OIDC_CLIENT_ID || "";
  const now = Math.floor(Date.now() / 1_000);
  if (claims.iss?.replace(/\/+$/, "") !== readiness.oidc.issuer) throw new Error("OIDC ID token issuer does not match configuration.");
  if (!audience.includes(clientId)) throw new Error("OIDC ID token audience does not include this client.");
  if (!claims.sub) throw new Error("OIDC ID token subject is missing.");
  if (!claims.exp || claims.exp <= now - 60) throw new Error("OIDC ID token is expired.");
  if (claims.iat && claims.iat > now + 60) throw new Error("OIDC ID token was issued in the future.");
  if (expectedNonce !== undefined && claims.nonce !== expectedNonce) throw new Error("OIDC ID token nonce does not match.");
  return { ok: true as const, identity: { subject: claims.sub, issuer: claims.iss, email: claims.email || null, name: claims.name || null }, validation: { signature: true, issuer: true, audience: true, expiry: true, nonce: expectedNonce === undefined ? "not-requested" : "matched" } };
}

export function listScimResources(kind: "users" | "groups") {
  const resources = readDirectory()[kind];
  return { schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"], totalResults: resources.length, startIndex: 1, itemsPerPage: resources.length, Resources: resources };
}

export function createScimResource(kind: "users" | "groups", input: Record<string, unknown>) {
  const directory = readDirectory(); const now = new Date().toISOString(); const id = randomUUID();
  if (kind === "users") {
    const userName = typeof input.userName === "string" ? input.userName.trim() : "";
    if (!userName) throw new Error("SCIM userName is required.");
    const user: ScimUser = { id, userName, displayName: typeof input.displayName === "string" ? input.displayName : undefined, active: input.active !== false, externalId: typeof input.externalId === "string" ? input.externalId : undefined, meta: { resourceType: "User", created: now, lastModified: now } };
    writeDirectory({ ...directory, users: [user, ...directory.users] }); return user;
  }
  const displayName = typeof input.displayName === "string" ? input.displayName.trim() : "";
  if (!displayName) throw new Error("SCIM group displayName is required.");
  const members = Array.isArray(input.members) ? input.members.filter((member): member is { value: string; display?: string } => Boolean(member && typeof member === "object" && typeof (member as { value?: unknown }).value === "string")) : [];
  const group: ScimGroup = { id, displayName, members, meta: { resourceType: "Group", created: now, lastModified: now } };
  writeDirectory({ ...directory, groups: [group, ...directory.groups] }); return group;
}

export function readScimResource(kind: "users" | "groups", id: string) {
  return readDirectory()[kind].find((resource) => resource.id === id) || null;
}

export function patchScimResource(kind: "users" | "groups", id: string, operations: Array<{ op?: string; path?: string; value?: unknown }>) {
  const directory = readDirectory();
  const collection = directory[kind];
  const index = collection.findIndex((resource) => resource.id === id);
  if (index < 0) throw new Error("SCIM resource was not found.");
  let resource = { ...collection[index] } as ScimUser | ScimGroup;
  for (const operation of operations) {
    const op = operation.op?.toLowerCase();
    if (op !== "replace" && op !== "add" && op !== "remove") throw new Error(`Unsupported SCIM patch operation: ${operation.op || "missing"}.`);
    const field = operation.path?.trim();
    if (!field || !["active", "displayName", "userName", "members"].includes(field)) throw new Error(`Unsupported SCIM patch path: ${field || "missing"}.`);
    if (field === "active" && kind === "users") resource = { ...(resource as ScimUser), active: op === "remove" ? false : operation.value !== false };
    else if (field === "displayName") resource = { ...resource, displayName: op === "remove" ? "" : String(operation.value || "") } as typeof resource;
    else if (field === "userName" && kind === "users") resource = { ...(resource as ScimUser), userName: String(operation.value || "").trim() };
    else if (field === "members" && kind === "groups") resource = { ...(resource as ScimGroup), members: op === "remove" ? [] : Array.isArray(operation.value) ? operation.value.filter((member): member is { value: string; display?: string } => Boolean(member && typeof member === "object" && typeof (member as { value?: unknown }).value === "string")) : [] };
  }
  resource = { ...resource, meta: { ...resource.meta, lastModified: new Date().toISOString() } } as typeof resource;
  if (kind === "users") writeDirectory({ ...directory, users: directory.users.map((entry) => entry.id === id ? resource as ScimUser : entry) });
  else writeDirectory({ ...directory, groups: directory.groups.map((entry) => entry.id === id ? resource as ScimGroup : entry) });
  return resource;
}

export function deleteScimResource(kind: "users" | "groups", id: string) {
  const directory = readDirectory();
  if (!readScimResource(kind, id)) throw new Error("SCIM resource was not found.");
  if (kind === "users") {
    patchScimResource("users", id, [{ op: "replace", path: "active", value: false }]);
    return { deleted: false, deactivated: true };
  }
  writeDirectory({ ...directory, groups: directory.groups.filter((group) => group.id !== id) });
  return { deleted: true, deactivated: false };
}
