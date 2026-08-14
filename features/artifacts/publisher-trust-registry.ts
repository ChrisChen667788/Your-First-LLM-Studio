import { createHash, createPublicKey, randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

import {
  readJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";

export const ARTIFACT_PUBLISHER_TRUST_SCHEMA_VERSION =
  "artifacts.publisher-trust.v1" as const;

export type ArtifactPublisherTrustRoot = {
  id: string;
  publisher: string;
  keyId: string;
  algorithm: "ed25519";
  publicKeyPem: string;
  publicKeyDigest: string;
  status: "active" | "revoked";
  validFrom: string;
  validUntil?: string;
  createdAt: string;
  revokedAt?: string;
  revocationReason?: string;
};

type Store = {
  schemaVersion: typeof ARTIFACT_PUBLISHER_TRUST_SCHEMA_VERSION;
  roots: ArtifactPublisherTrustRoot[];
};

const DATA_DIR =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "local-agent-lab",
    "observability",
  );
const STORE_FILE = path.join(DATA_DIR, "artifact-publisher-trust.json");

function emptyStore(): Store {
  return { schemaVersion: ARTIFACT_PUBLISHER_TRUST_SCHEMA_VERSION, roots: [] };
}

function isStore(value: unknown): value is Store {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Store>;
  return candidate.schemaVersion === ARTIFACT_PUBLISHER_TRUST_SCHEMA_VERSION &&
    Array.isArray(candidate.roots);
}

function readStore() {
  return readJsonFileDurably(STORE_FILE, emptyStore, isStore);
}

function normalizeIdentity(value: string, label: string) {
  const normalized = value.trim();
  if (!/^[a-z0-9][a-z0-9._:-]{1,127}$/iu.test(normalized)) {
    throw new Error(`${label} must use a stable registry-safe identifier.`);
  }
  return normalized;
}

export function registerArtifactPublisherTrustRoot(input: {
  publisher: string;
  keyId: string;
  publicKeyPem: string;
  validFrom?: string;
  validUntil?: string;
}) {
  const publisher = normalizeIdentity(input.publisher, "publisher");
  const keyId = normalizeIdentity(input.keyId, "keyId");
  const publicKeyPem = input.publicKeyPem.trim();
  const key = createPublicKey(publicKeyPem);
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("Artifact publisher trust roots must use Ed25519 keys.");
  }
  const now = new Date().toISOString();
  const validFrom = input.validFrom || now;
  const validUntil = input.validUntil;
  if (!Number.isFinite(Date.parse(validFrom))) throw new Error("validFrom is invalid.");
  if (validUntil && Date.parse(validUntil) <= Date.parse(validFrom)) {
    throw new Error("validUntil must be later than validFrom.");
  }
  const publicKeyDigest = createHash("sha256").update(publicKeyPem).digest("hex");
  let saved: ArtifactPublisherTrustRoot | null = null;
  updateJsonFileDurably(
    STORE_FILE,
    emptyStore,
    (store) => {
      const existing = store.roots.find(
        (root) => root.publisher === publisher && root.keyId === keyId,
      );
      if (existing && existing.publicKeyDigest !== publicKeyDigest) {
        throw new Error("A publisher keyId cannot be rebound to different key material.");
      }
      if (existing) {
        saved = existing;
        return store;
      }
      saved = {
        id: `artifact-trust-${randomUUID()}`,
        publisher,
        keyId,
        algorithm: "ed25519",
        publicKeyPem,
        publicKeyDigest,
        status: "active",
        validFrom,
        validUntil,
        createdAt: now,
      };
      return { ...store, roots: [saved, ...store.roots].slice(0, 500) };
    },
    isStore,
  );
  return saved!;
}

export function revokeArtifactPublisherTrustRoot(input: {
  publisher: string;
  keyId: string;
  reason: string;
}) {
  const publisher = normalizeIdentity(input.publisher, "publisher");
  const keyId = normalizeIdentity(input.keyId, "keyId");
  const reason = input.reason.trim();
  if (reason.length < 8) throw new Error("A meaningful revocation reason is required.");
  let saved: ArtifactPublisherTrustRoot | null = null;
  updateJsonFileDurably(
    STORE_FILE,
    emptyStore,
    (store) => ({
      ...store,
      roots: store.roots.map((root) => {
        if (root.publisher !== publisher || root.keyId !== keyId) return root;
        saved = root.status === "revoked" ? root : {
          ...root,
          status: "revoked",
          revokedAt: new Date().toISOString(),
          revocationReason: reason,
        };
        return saved!;
      }),
    }),
    isStore,
  );
  if (!saved) throw new Error("Artifact publisher trust root was not found.");
  return saved;
}

export function resolveArtifactPublisherTrustRoot(input: {
  publisher: string;
  keyId: string;
  at?: string;
}) {
  const root = readStore().roots.find(
    (candidate) =>
      candidate.publisher === input.publisher && candidate.keyId === input.keyId,
  ) || null;
  if (!root) return null;
  const at = Date.parse(input.at || new Date().toISOString());
  const valid = root.status === "active" &&
    Date.parse(root.validFrom) <= at &&
    (!root.validUntil || Date.parse(root.validUntil) > at);
  return { ...root, valid };
}

export function readArtifactPublisherTrustRegistry() {
  const store = readStore();
  return {
    ok: true as const,
    schemaVersion: ARTIFACT_PUBLISHER_TRUST_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    roots: store.roots.map(({ publicKeyPem: _publicKeyPem, ...root }) => root),
    totals: {
      roots: store.roots.length,
      active: store.roots.filter((root) => root.status === "active").length,
      revoked: store.roots.filter((root) => root.status === "revoked").length,
      publishers: new Set(store.roots.map((root) => root.publisher)).size,
    },
    path: STORE_FILE,
  };
}
