import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import os from "node:os";
import path from "node:path";

import {
  readDurableJsonStore,
  updateDurableJsonStore,
} from "@/features/persistence/durable-json-store";

export const IDENTITY_EVENT_DELIVERY_SCHEMA_VERSION =
  "governance.identity-event-delivery.v1" as const;

export type IdentityEventDelivery = {
  deliveryId: string;
  timestamp: number;
  bodyDigest: string;
  acceptedAt: string;
};

type IdentityEventDeliveryStore = {
  schemaVersion: typeof IDENTITY_EVENT_DELIVERY_SCHEMA_VERSION;
  deliveries: IdentityEventDelivery[];
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
const STORE_FILE = path.join(DATA_DIR, "governance", "identity-event-deliveries.json");
const DEFAULT_MAX_AGE_MS = 5 * 60_000;

const storeOptions = {
  filePath: STORE_FILE,
  initial: (): IdentityEventDeliveryStore => ({
    schemaVersion: IDENTITY_EVENT_DELIVERY_SCHEMA_VERSION,
    deliveries: [],
  }),
  validate: (value: unknown): value is IdentityEventDeliveryStore => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<IdentityEventDeliveryStore>;
    return (
      candidate.schemaVersion === IDENTITY_EVENT_DELIVERY_SCHEMA_VERSION &&
      Array.isArray(candidate.deliveries)
    );
  },
};

export class IdentityEventDeliveryError extends Error {
  constructor(
    readonly code:
      | "identity_event_not_configured"
      | "identity_event_invalid"
      | "identity_event_stale"
      | "identity_event_replay",
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "IdentityEventDeliveryError";
  }
}

function signaturePayload(input: {
  deliveryId: string;
  timestamp: number;
  body: string;
}) {
  return `${input.timestamp}.${input.deliveryId}.${input.body}`;
}

export function signIdentityEventDelivery(
  input: { deliveryId: string; timestamp: number; body: string },
  secret: string,
) {
  if (!secret) throw new Error("Identity event signing secret is required.");
  return `sha256=${createHmac("sha256", secret)
    .update(signaturePayload(input))
    .digest("hex")}`;
}

export function verifyIdentityEventDelivery(input: {
  deliveryId: string;
  timestamp: number;
  body: string;
  signature: string;
  secret: string;
  now?: number;
  maxAgeMs?: number;
}) {
  if (!input.secret) {
    throw new IdentityEventDeliveryError(
      "identity_event_not_configured",
      503,
      "Identity event delivery is disabled because FIRST_LLM_IDENTITY_EVENT_SECRET is not configured.",
    );
  }
  if (!input.deliveryId.trim() || !Number.isFinite(input.timestamp)) {
    throw new IdentityEventDeliveryError(
      "identity_event_invalid",
      400,
      "Identity event delivery id and timestamp are required.",
    );
  }
  const now = input.now ?? Date.now();
  const maxAgeMs = Math.max(1_000, input.maxAgeMs ?? DEFAULT_MAX_AGE_MS);
  if (input.timestamp < now - maxAgeMs || input.timestamp > now + 60_000) {
    throw new IdentityEventDeliveryError(
      "identity_event_stale",
      401,
      "Identity event timestamp is outside the accepted freshness window.",
    );
  }
  const expected = Buffer.from(
    signIdentityEventDelivery(input, input.secret),
    "utf8",
  );
  const received = Buffer.from(input.signature || "", "utf8");
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    throw new IdentityEventDeliveryError(
      "identity_event_invalid",
      401,
      "Identity event signature is invalid.",
    );
  }
  return {
    signatureValid: true as const,
    fresh: true as const,
    bodyDigest: createHash("sha256").update(input.body).digest("hex"),
  };
}

export function acceptIdentityEventDelivery(input: {
  deliveryId: string;
  timestamp: number;
  body: string;
  signature: string;
  secret?: string;
  now?: number;
  maxAgeMs?: number;
}) {
  const verified = verifyIdentityEventDelivery({
    ...input,
    secret: input.secret || process.env.FIRST_LLM_IDENTITY_EVENT_SECRET || "",
  });
  const delivery: IdentityEventDelivery = {
    deliveryId: input.deliveryId.trim(),
    timestamp: input.timestamp,
    bodyDigest: verified.bodyDigest,
    acceptedAt: new Date(input.now ?? Date.now()).toISOString(),
  };
  updateDurableJsonStore(storeOptions, (store) => {
    if (store.deliveries.some((entry) => entry.deliveryId === delivery.deliveryId)) {
      throw new IdentityEventDeliveryError(
        "identity_event_replay",
        409,
        "Identity event delivery was already accepted.",
      );
    }
    return {
      ...store,
      deliveries: [delivery, ...store.deliveries].slice(0, 2_000),
    };
  });
  return delivery;
}

export function readIdentityEventDeliveryEvidence() {
  const store = readDurableJsonStore(storeOptions);
  return {
    ok: true as const,
    schemaVersion: IDENTITY_EVENT_DELIVERY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    configured: Boolean(process.env.FIRST_LLM_IDENTITY_EVENT_SECRET),
    totals: { accepted: store.deliveries.length },
    recent: store.deliveries.slice(0, 25),
    path: STORE_FILE,
  };
}
