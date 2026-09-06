import type { EvidenceOperationMilestoneSpec } from "@/features/evidence/operational-receipts";
import { operationalReadModelDigest } from "@/features/evidence/operational-receipts";
import { readLocalServerDiagnosticsV3 } from "@/features/models/local-server-diagnostics-v3";
import { readModelHubOperationsV3 } from "@/features/models/model-hub-operations-v3";

export function readModelEvidenceOperationSpecs(): EvidenceOperationMilestoneSpec[] {
  const modelHub = readModelHubOperationsV3();
  const server = readLocalServerDiagnosticsV3();
  return [
    {
      version: "v4.0.8",
      label: "Model Transfer and Provenance",
      owner: "features/models",
      track: "models",
      contract: "models.transfer-provenance-receipts.v1",
      requiredMetrics: ["files", "bytes", "checksumsVerified"],
      currentSignal: {
        status: modelHub.localStatus,
        summary: `${modelHub.totals.evidencedActions}/${modelHub.totals.actions} lifecycle action(s) have current local evidence.`,
        evidenceDigest: operationalReadModelDigest(modelHub),
      },
      localGate: "Complete an authenticated multi-file transfer, interrupted resume, checksum read-back, migration, and runtime activation.",
      externalGate: "Hub ownership, malware/license review, and organization mirror acceptance remain external.",
    },
    {
      version: "v4.0.9",
      label: "Local Server Load and Drain",
      owner: "features/models",
      track: "runtime",
      contract: "models.local-server-load-drain.v1",
      requiredMetrics: ["requests", "cancelled", "drainPasses"],
      currentSignal: {
        status: server.localStatus,
        summary: `${server.instances.length} server instance(s), ${server.totals.requests} request ledger row(s); load and drain remain evidence-gated.`,
        evidenceDigest: operationalReadModelDigest(server),
      },
      localGate: "Run bounded concurrency, cancellation, drain-aware hot switch, rollback, idle unload, and API conformance.",
      externalGate: "Independent load generation, LAN security review, and SLO acceptance remain external.",
    },
  ];
}
