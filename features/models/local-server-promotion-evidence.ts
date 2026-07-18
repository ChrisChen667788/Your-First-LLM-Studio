import { createHash } from "crypto";
import { readLocalServerAcceptanceEvidence } from "@/features/models/local-server-acceptance";

export const LOCAL_SERVER_PROMOTION_SCHEMA_VERSION =
  "models.local-server-promotion.v1" as const;

function stableDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildLocalServerPromotionEvidence() {
  const acceptance = readLocalServerAcceptanceEvidence();
  const receipt = acceptance.latest || null;
  const passedSlices = new Set(
    (receipt?.slices || [])
      .filter((slice) => slice.status === "pass")
      .map((slice) => slice.id),
  );
  const localChecks = {
    realRuntime: Boolean(receipt?.runtime.realProcess),
    realModel: Boolean(receipt?.runtime.realModel),
    allFifteenSlices:
      receipt?.totals.slices === 15 && receipt.totals.passed === 15,
    openAiCompatibility: passedSlices.has("openai-models-and-chat"),
    streamingSse: passedSlices.has("streaming-sse"),
    boundedConcurrency: passedSlices.has("bounded-concurrency"),
    accounting: passedSlices.has("token-latency-ledger"),
    unloadReloadRecovery: passedSlices.has("unload-reload-recovery"),
  };
  const productionChecks = {
    authenticatedLanFromSeparateDevice: false,
    sustainedIdleEvictionDaemon: false,
  };
  const localBlockers = Object.entries(localChecks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `Local Server acceptance check failed: ${name}.`);
  const productionBlockers = [
    "Authenticated LAN traffic still needs a separate-device receipt.",
    "Idle eviction still needs a sustained daemon-window receipt.",
  ];
  const core = {
    schemaVersion: LOCAL_SERVER_PROMOTION_SCHEMA_VERSION,
    localStatus: localBlockers.length
      ? ("evidence-needed" as const)
      : ("pass" as const),
    productionStatus: "hold" as const,
    localChecks,
    productionChecks,
    localBlockers,
    productionBlockers,
    receiptId: receipt?.id || null,
    receiptDigest: receipt?.evidenceDigest || null,
  };
  return {
    ok: true as const,
    ...core,
    generatedAt: new Date().toISOString(),
    evidenceDigest: stableDigest(core),
    acceptancePath: acceptance.path,
  };
}
