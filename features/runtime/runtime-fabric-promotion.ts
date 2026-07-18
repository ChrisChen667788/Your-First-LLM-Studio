import { createHash } from "crypto";
import { readRuntimeFabricAcceptanceEvidence } from "@/features/runtime/runtime-fabric-acceptance";

export const RUNTIME_FABRIC_PROMOTION_SCHEMA_VERSION =
  "runtime.fabric-promotion.v1" as const;

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildRuntimeFabricPromotionEvidence() {
  const evidence = readRuntimeFabricAcceptanceEvidence();
  const receipt = evidence.latest || null;
  const passingBackends = new Set(
    (receipt?.backends || [])
      .filter((backend) => backend.status === "pass")
      .map((backend) => backend.backend),
  );
  const localChecks = {
    realMlx: passingBackends.has("mlx"),
    realOllama: passingBackends.has("ollama"),
    realLlamaCpp: passingBackends.has("llama.cpp"),
    sixImplementedAdapters: receipt?.adapterContract.implemented === 6,
    sixConformantAdapters: receipt?.adapterContract.conformant === 6,
    noPlannedAdapters: receipt?.adapterContract.planned === 0,
    normalizedOperationMatrix:
      Boolean(receipt?.adapterContract.operationChecks) &&
      receipt?.adapterContract.operationChecks ===
        receipt?.adapterContract.normalizedOperationChecks,
    actionableCompatibilityRejections: Boolean(
      receipt?.compatibilityMatrix
        .filter((profile) => !profile.compatible)
        .every((profile) => profile.codes.length > 0),
    ),
  };
  const productionChecks = {
    realLocalAiNode: false,
    realLinuxNvidiaVllmAndSglang: false,
    heterogeneousRemoteNodeFailover: false,
  };
  const localBlockers = Object.entries(localChecks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `Runtime Fabric local check failed: ${check}.`);
  const productionBlockers = [
    "A real LocalAI endpoint receipt is still required.",
    "vLLM and SGLang still require real Linux/NVIDIA conformance receipts.",
    "Heterogeneous remote-node failover still requires separate-machine evidence.",
  ];
  const core = {
    schemaVersion: RUNTIME_FABRIC_PROMOTION_SCHEMA_VERSION,
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
    evidenceDigest: digest({
      schemaVersion: core.schemaVersion,
      localStatus: core.localStatus,
      productionStatus: core.productionStatus,
      localChecks: core.localChecks,
      productionChecks: core.productionChecks,
      localBlockers: core.localBlockers,
      productionBlockers: core.productionBlockers,
      receiptDigest: core.receiptDigest,
    }),
    acceptancePath: evidence.path,
  };
}
