import { createHash, randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

import {
  discoverOidcProvider,
  replaceScimDirectorySnapshot,
  type ScimGroup,
  type ScimUser,
} from "@/features/governance/identity-provisioning";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";

export const ENTERPRISE_IDP_ADAPTER_SCHEMA_VERSION =
  "governance.enterprise-idp-adapter.v1" as const;

const LIST_RESPONSE_SCHEMA =
  "urn:ietf:params:scim:api:messages:2.0:ListResponse";
const SERVICE_CONFIG_SCHEMA =
  "urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig";
const DATA_DIR =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "local-agent-lab",
    "observability",
  );
const STORE_FILE = path.join(DATA_DIR, "governance", "enterprise-idp-adapter.json");

type JsonRecord = Record<string, unknown>;

export type EnterpriseIdpAdapterReceipt = {
  id: string;
  generatedAt: string;
  action: "probe" | "sync";
  status: "pass" | "hold";
  productionStatus: "hold";
  provider: {
    issuer: string;
    issuerDigest: string;
    scimBaseUrlDigest: string;
    oidcKeyIds: string[];
  };
  scim: {
    users: number;
    groups: number;
    paginationComplete: boolean;
    serviceProviderConfigValid: boolean;
    localDirectoryUpdated: boolean;
  };
  checks: {
    oidcDiscoveryValid: boolean;
    jwksAvailable: boolean;
    scimServiceConfigValid: boolean;
    scimListResponsesValid: boolean;
    scimPaginationComplete: boolean;
  };
  blockers: string[];
  productionBlockers: string[];
};

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function configuredScimProvider() {
  const baseUrl = process.env.FIRST_LLM_SCIM_PROVIDER_BASE_URL
    ?.trim()
    .replace(/\/+$/u, "") || "";
  const token = process.env.FIRST_LLM_SCIM_PROVIDER_TOKEN?.trim() || "";
  if (!baseUrl || !token) {
    throw new Error(
      "SCIM provider requires FIRST_LLM_SCIM_PROVIDER_BASE_URL and FIRST_LLM_SCIM_PROVIDER_TOKEN.",
    );
  }
  const url = new URL(baseUrl);
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (url.protocol !== "https:" && !local) {
    throw new Error("A remote SCIM provider must use HTTPS.");
  }
  return { baseUrl, token };
}

async function fetchScim(pathname: string) {
  const provider = configuredScimProvider();
  const response = await fetch(`${provider.baseUrl}${pathname}`, {
    cache: "no-store",
    headers: {
      accept: "application/scim+json, application/json",
      authorization: `Bearer ${provider.token}`,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`SCIM provider returned HTTP ${response.status} for ${pathname}.`);
  }
  return response.json() as Promise<JsonRecord>;
}

function schemasOf(value: JsonRecord) {
  return Array.isArray(value.schemas)
    ? value.schemas.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function requiredText(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`SCIM resource is missing ${field}.`);
  }
  return value.trim();
}

function resourceTimestamp(value: JsonRecord, fallback: string) {
  const meta = value.meta && typeof value.meta === "object"
    ? value.meta as JsonRecord
    : {};
  return {
    created: typeof meta.created === "string" ? meta.created : fallback,
    lastModified:
      typeof meta.lastModified === "string" ? meta.lastModified : fallback,
  };
}

function normalizeUser(value: JsonRecord, syncedAt: string): ScimUser {
  return {
    id: requiredText(value.id, "User.id"),
    userName: requiredText(value.userName, "User.userName"),
    displayName:
      typeof value.displayName === "string" ? value.displayName : undefined,
    active: value.active !== false,
    externalId:
      typeof value.externalId === "string" ? value.externalId : undefined,
    meta: {
      resourceType: "User",
      ...resourceTimestamp(value, syncedAt),
    },
  };
}

function normalizeGroup(value: JsonRecord, syncedAt: string): ScimGroup {
  const members = Array.isArray(value.members)
    ? value.members.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const member = entry as JsonRecord;
        if (typeof member.value !== "string" || !member.value.trim()) return [];
        return [{
          value: member.value.trim(),
          display:
            typeof member.display === "string" ? member.display : undefined,
        }];
      })
    : [];
  return {
    id: requiredText(value.id, "Group.id"),
    displayName: requiredText(value.displayName, "Group.displayName"),
    members,
    meta: {
      resourceType: "Group",
      ...resourceTimestamp(value, syncedAt),
    },
  };
}

async function readScimCollection(pathname: "/Users" | "/Groups") {
  const resources: JsonRecord[] = [];
  let startIndex = 1;
  let totalResults = Number.POSITIVE_INFINITY;
  let pages = 0;
  while (resources.length < totalResults) {
    const separator = pathname.includes("?") ? "&" : "?";
    const payload = await fetchScim(
      `${pathname}${separator}startIndex=${startIndex}&count=100`,
    );
    if (!schemasOf(payload).includes(LIST_RESPONSE_SCHEMA)) {
      throw new Error(`${pathname} did not return a SCIM ListResponse.`);
    }
    const page = Array.isArray(payload.Resources)
      ? payload.Resources.filter(
          (entry): entry is JsonRecord => Boolean(entry && typeof entry === "object"),
        )
      : [];
    totalResults = Number(payload.totalResults);
    if (!Number.isInteger(totalResults) || totalResults < 0) {
      throw new Error(`${pathname} returned an invalid totalResults value.`);
    }
    resources.push(...page);
    pages += 1;
    if (!page.length || pages >= 100) break;
    startIndex += page.length;
  }
  return {
    resources,
    complete: resources.length >= totalResults,
  };
}

async function probeOidcProvider() {
  const discovery = await discoverOidcProvider();
  const response = await fetch(discovery.endpoints.jwks, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`OIDC JWKS returned HTTP ${response.status}.`);
  const payload = await response.json() as { keys?: JsonRecord[] };
  const keyIds = Array.isArray(payload.keys)
    ? payload.keys.flatMap((key) => {
        const signingKey =
          typeof key.kid === "string" &&
          (!key.use || key.use === "sig") &&
          (!key.alg || key.alg === "RS256");
        return signingKey ? [key.kid as string] : [];
      })
    : [];
  if (!keyIds.length) throw new Error("OIDC JWKS has no usable signing key.");
  return { discovery, keyIds };
}

export function readEnterpriseIdpAdapterReadiness() {
  const issuer = process.env.FIRST_LLM_OIDC_ISSUER?.trim() || "";
  const scimBaseUrl = process.env.FIRST_LLM_SCIM_PROVIDER_BASE_URL?.trim() || "";
  const oidcConfigured = Boolean(issuer && process.env.FIRST_LLM_OIDC_CLIENT_ID);
  const scimConfigured = Boolean(
    scimBaseUrl && process.env.FIRST_LLM_SCIM_PROVIDER_TOKEN,
  );
  const receipts = readDurableReceipts<EnterpriseIdpAdapterReceipt>(
    STORE_FILE,
    ENTERPRISE_IDP_ADAPTER_SCHEMA_VERSION,
  );
  return {
    ok: true as const,
    schemaVersion: ENTERPRISE_IDP_ADAPTER_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    configured: oidcConfigured && scimConfigured,
    oidc: { configured: oidcConfigured, issuer: issuer || null },
    scim: {
      configured: scimConfigured,
      baseUrl: scimBaseUrl ? safeOrigin(scimBaseUrl) : null,
    },
    latest: receipts[0] || null,
    receipts,
    productionStatus: "hold" as const,
    productionBlockers: receipts[0]?.productionBlockers || [
      "An organization-controlled IdP and SCIM tenant have not supplied a signed acceptance receipt.",
    ],
    path: STORE_FILE,
  };
}

export async function runEnterpriseIdpAdapter(input: { sync: boolean }) {
  const generatedAt = new Date().toISOString();
  const oidc = await probeOidcProvider();
  const serviceConfig = await fetchScim("/ServiceProviderConfig");
  const serviceProviderConfigValid = schemasOf(serviceConfig).includes(
    SERVICE_CONFIG_SCHEMA,
  );
  if (!serviceProviderConfigValid) {
    throw new Error("SCIM ServiceProviderConfig schema is missing.");
  }
  const [usersPage, groupsPage] = await Promise.all([
    readScimCollection("/Users"),
    readScimCollection("/Groups"),
  ]);
  const users = usersPage.resources.map((user) => normalizeUser(user, generatedAt));
  const groups = groupsPage.resources.map((group) => normalizeGroup(group, generatedAt));
  if (input.sync) replaceScimDirectorySnapshot({ users, groups });
  const checks = {
    oidcDiscoveryValid: oidc.discovery.issuer.replace(/\/+$/u, "") ===
      (process.env.FIRST_LLM_OIDC_ISSUER || "").replace(/\/+$/u, ""),
    jwksAvailable: oidc.keyIds.length > 0,
    scimServiceConfigValid: serviceProviderConfigValid,
    scimListResponsesValid: true,
    scimPaginationComplete: usersPage.complete && groupsPage.complete,
  };
  const blockers = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `Enterprise IdP adapter check failed: ${check}.`);
  const scimBaseUrl = configuredScimProvider().baseUrl;
  const productionBlockers = [
    "Organization security must approve the IdP tenant, SCIM token scope, and key-rotation policy.",
    "A production OIDC login and SCIM deprovision event must be signed off by an independent operator.",
  ];
  const receipt: EnterpriseIdpAdapterReceipt = {
    id: `enterprise-idp-${randomUUID()}`,
    generatedAt,
    action: input.sync ? "sync" : "probe",
    status: blockers.length ? "hold" : "pass",
    productionStatus: "hold",
    provider: {
      issuer: oidc.discovery.issuer,
      issuerDigest: digest(oidc.discovery.issuer),
      scimBaseUrlDigest: digest(scimBaseUrl),
      oidcKeyIds: oidc.keyIds,
    },
    scim: {
      users: users.length,
      groups: groups.length,
      paginationComplete: usersPage.complete && groupsPage.complete,
      serviceProviderConfigValid,
      localDirectoryUpdated: input.sync,
    },
    checks,
    blockers,
    productionBlockers,
  };
  prependDurableReceipt(
    STORE_FILE,
    ENTERPRISE_IDP_ADAPTER_SCHEMA_VERSION,
    receipt,
    100,
  );
  return receipt;
}
