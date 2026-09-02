import { createHash, randomUUID } from "node:crypto";

import { readAgentHarnessConformance } from "@/features/agent/harness-conformance";
import { readInteractionCacheEvidence } from "@/features/agent/interaction-cache";
import { readIsolatedAgentTeamEvidence } from "@/features/agent/isolated-team-service";
import { readMultimodalCapabilityRegistry } from "@/features/benchmark/multimodal-capability-registry";
import { readCompetitiveSourceRegistry } from "@/features/competitive/source-registry";
import { readSecureSandboxFabricEvidence } from "@/features/extensions/secure-sandbox-fabric";
import { readFineTuneBackendFederation } from "@/features/finetune/backend-federation";
import { readTeamStudioMarketplaceEvidence } from "@/features/governance/team-studio-marketplace";
import { readLocalServerDiagnosticsV3 } from "@/features/models/local-server-diagnostics-v3";
import { readModelHubOperationsV3 } from "@/features/models/model-hub-operations-v3";
import { prependDurableReceipt, readDurableReceipts } from "@/features/persistence/durable-receipt-store";
import { readProviderCapabilityCatalog } from "@/features/providers/capability-application";
import { readWorkloadRoutingReadModel } from "@/features/providers/workload-routing";
import { readConnectorIndexLifecycleEvidence } from "@/features/retrieval/connector-index-lifecycle";
import { readRagQualityLoopEvidence } from "@/features/retrieval/rag-quality-loop";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export const COMPETITIVE_PRODUCT_TRAIN_SCHEMA_VERSION =
  "experiments.competitive-product-train.v1" as const;
const STORE_SCHEMA_VERSION = "experiments.competitive-product-train-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath(
  "experiments",
  "v3.8.0-v3.9.4-competitive-product-train.json",
);

type VersionId =
  | "v3.8.0" | "v3.8.1" | "v3.8.2" | "v3.8.3" | "v3.8.4"
  | "v3.8.5" | "v3.8.6" | "v3.8.7" | "v3.8.8" | "v3.8.9"
  | "v3.9.0" | "v3.9.1" | "v3.9.2" | "v3.9.3" | "v3.9.4";

type TrainVersion = {
  version: VersionId;
  label: string;
  sourceStatus: "pass";
  localStatus: "pass" | "hold";
  externalStatus: "hold";
  productionStatus: "hold";
  contract: string;
  localEvidence: string;
  remainingGate: string;
};

type TrainState = {
  sourceStatus: "pass";
  localStatus: "pass" | "hold";
  externalStatus: "hold";
  productionStatus: "hold";
  versions: TrainVersion[];
  totals: {
    versions: 15;
    sourcePassed: 15;
    localPassed: number;
    localHeld: number;
    externalHeld: 15;
  };
  freshness: {
    maxAgeDays: 14;
    freshSources: number;
    staleSources: number;
    reviewRequired: number;
    promotionEligible: boolean;
  };
  disclosure: string;
  stateDigest: string;
};

type TrainReceipt = TrainState & {
  id: string;
  generatedAt: string;
  evidenceDigest: string;
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildCompetitiveProductTrainState(): TrainState {
  const sources = readCompetitiveSourceRegistry();
  const providers = readProviderCapabilityCatalog();
  const routing = readWorkloadRoutingReadModel();
  const harness = readAgentHarnessConformance();
  const cache = readInteractionCacheEvidence();
  const teams = readIsolatedAgentTeamEvidence();
  const sandbox = readSecureSandboxFabricEvidence();
  const multimodal = readMultimodalCapabilityRegistry();
  const modelHub = readModelHubOperationsV3();
  const server = readLocalServerDiagnosticsV3();
  const corpus = readConnectorIndexLifecycleEvidence();
  const ragQuality = readRagQualityLoopEvidence();
  const training = readFineTuneBackendFederation();
  const marketplace = readTeamStudioMarketplaceEvidence();
  const freshnessEligible =
    sources.totals.stale === 0 && sources.totals.reviewRequired === 0;

  const versions: TrainVersion[] = [
    { version: "v3.8.0", label: "Competitive Intelligence Registry", sourceStatus: "pass", localStatus: freshnessEligible && sources.totals.sources > 0 ? "pass" : "hold", externalStatus: "hold", productionStatus: "hold", contract: sources.schemaVersion, localEvidence: `${sources.totals.sources} official sources; ${sources.totals.stale} stale; ${sources.totals.reviewRequired} require review.`, remainingGate: "A changed official source must be reviewed before claims or roadmap entries change." },
    { version: "v3.8.1", label: "Provider Capability Discovery", sourceStatus: "pass", localStatus: providers.totals.targets > 0 ? "pass" : "hold", externalStatus: "hold", productionStatus: "hold", contract: providers.schemaVersion, localEvidence: `${providers.totals.targets} targets; ${providers.totals.configuredRemote} configured remote targets; model-list probe precedes inference.`, remainingGate: "Each paid account still needs a current /models receipt and task-level modality probe." },
    { version: "v3.8.2", label: "Workload Routing Scorecards", sourceStatus: "pass", localStatus: routing.selectedTargetId ? "pass" : "hold", externalStatus: "hold", productionStatus: "hold", contract: routing.schemaVersion, localEvidence: routing.decision, remainingGate: "Attach at least 20 workload-aligned quality samples per candidate before any automatic route choice." },
    { version: "v3.8.3", label: "Agent Harness Conformance", sourceStatus: "pass", localStatus: harness.localStatus, externalStatus: "hold", productionStatus: "hold", contract: harness.schemaVersion, localEvidence: `${harness.totals.passed}/${harness.totals.scenarios} deterministic scenarios pass.`, remainingGate: "Run the suite against every live provider and runtime with reconnect and cancellation receipts." },
    { version: "v3.8.4", label: "Stateful Interaction and Cache", sourceStatus: "pass", localStatus: cache.localStatus, externalStatus: "hold", productionStatus: "hold", contract: cache.schemaVersion, localEvidence: `${cache.attribution.hits} hit and ${cache.attribution.misses} miss observations.`, remainingGate: "Provider-native cached-token billing is required before claiming monetary savings." },
    { version: "v3.8.5", label: "Isolated Multi-agent Teams", sourceStatus: "pass", localStatus: teams.localStatus, externalStatus: "hold", productionStatus: "hold", contract: teams.schemaVersion, localEvidence: `${teams.agents.length} isolated reference agents; merge policy ${teams.mergePolicy}.`, remainingGate: "Separate workers, crash recovery and controlled merge need live repository receipts." },
    { version: "v3.8.6", label: "Secure Sandbox Fabric", sourceStatus: "pass", localStatus: sandbox.localStatus, externalStatus: "hold", productionStatus: "hold", contract: sandbox.schemaVersion, localEvidence: `Preferred isolation ${sandbox.capabilities.preferredIsolation}; OS receipt ${sandbox.latestOsEnforcedPassing ? "present" : "absent"}.`, remainingGate: "Managed remote executors need brokered network/secrets and teardown evidence." },
    { version: "v3.8.7", label: "Multimodal Capability and Evaluator Registry", sourceStatus: "pass", localStatus: multimodal.localStatus, externalStatus: "hold", productionStatus: "hold", contract: multimodal.schemaVersion, localEvidence: `${multimodal.conformance.passed}/${multimodal.conformance.total} evaluator conformance checks pass.`, remainingGate: "Install licensed benchmark assets and obtain model-specific capability and official-score receipts." },
    { version: "v3.8.8", label: "Model Hub Operations v3", sourceStatus: "pass", localStatus: modelHub.localStatus, externalStatus: "hold", productionStatus: "hold", contract: modelHub.schemaVersion, localEvidence: `${modelHub.totals.evidencedActions}/${modelHub.totals.actions} canonical operations have local receipts.`, remainingGate: "Exercise real transfer, checksum, external-disk migration and runtime lifecycle for the promoted model." },
    { version: "v3.8.9", label: "Local Server Diagnostics v3", sourceStatus: "pass", localStatus: server.localStatus, externalStatus: "hold", productionStatus: "hold", contract: server.schemaVersion, localEvidence: `${server.instances.length} instances; ${server.totals.requests} ledger requests.`, remainingGate: "Run concurrency, batching, cancellation and OpenAI API parity under measured load." },
    { version: "v3.9.0", label: "Governed Connector and Index Lifecycle", sourceStatus: "pass", localStatus: corpus.localStatus, externalStatus: "hold", productionStatus: "hold", contract: corpus.schemaVersion, localEvidence: `Reference lifecycle ${corpus.lifecycle.status}; active revision ${corpus.lifecycle.activeRevisionId}.`, remainingGate: "Connect managed sources and reconcile revision/deletion propagation through deployed indexes." },
    { version: "v3.9.1", label: "RAG Quality and Feedback Loop", sourceStatus: "pass", localStatus: ragQuality.localStatus, externalStatus: "hold", productionStatus: "hold", contract: ragQuality.schemaVersion, localEvidence: `${ragQuality.decision.metrics.pairedSamples} paired fixture samples; decision ${ragQuality.decision.decision}.`, remainingGate: "Replace fixtures with a pinned corpus, identity leakage suite, evaluator versions and human feedback." },
    { version: "v3.9.2", label: "Fine-tune Backend Federation", sourceStatus: "pass", localStatus: training.localStatus, externalStatus: "hold", productionStatus: "hold", contract: training.schemaVersion, localEvidence: `${training.backends.length} negotiated backends; preview executors fail closed.`, remainingGate: "Run LLaMA-Factory and SWIFT on supported workers and compare their unified artifact packages." },
    { version: "v3.9.3", label: "Team Studio and Governed Marketplace", sourceStatus: "pass", localStatus: marketplace.localStatus, externalStatus: "hold", productionStatus: "hold", contract: marketplace.schemaVersion, localEvidence: `${Object.values(marketplace.checks).filter(Boolean).length}/${Object.values(marketplace.checks).length} governance checks have local evidence.`, remainingGate: "Real organization identity, trust-root rotation, concurrent revision and revocation drills remain required." },
    { version: "v3.9.4", label: "Competitive Promotion Gate", sourceStatus: "pass", localStatus: freshnessEligible ? "pass" : "hold", externalStatus: "hold", productionStatus: "hold", contract: COMPETITIVE_PRODUCT_TRAIN_SCHEMA_VERSION, localEvidence: freshnessEligible ? "All pinned sources are inside the 14-day review window with no unreviewed digest change." : "Freshness or review-required evidence blocks promotion.", remainingGate: "The freshness gate controls competitive claims only; it never overrides external or production approval." },
  ];
  const localPassed = versions.filter((version) => version.localStatus === "pass").length;
  const withoutDigest = {
    sourceStatus: "pass" as const,
    localStatus: localPassed === versions.length ? "pass" as const : "hold" as const,
    externalStatus: "hold" as const,
    productionStatus: "hold" as const,
    versions,
    totals: {
      versions: 15 as const,
      sourcePassed: 15 as const,
      localPassed,
      localHeld: 15 - localPassed,
      externalHeld: 15 as const,
    },
    freshness: {
      maxAgeDays: 14 as const,
      freshSources: sources.totals.fresh,
      staleSources: sources.totals.stale,
      reviewRequired: sources.totals.reviewRequired,
      promotionEligible: freshnessEligible,
    },
    disclosure:
      "All 15 repository-owned source contracts are implemented. Local runtime receipts remain itemized, external acceptance remains HOLD, and production remains HOLD; this screen cannot promote those boundaries.",
  };
  return { ...withoutDigest, stateDigest: digest(withoutDigest) };
}

export function runCompetitiveProductTrainAcceptance() {
  const state = buildCompetitiveProductTrainState();
  const withoutDigest = {
    id: `competitive-product-train-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    ...state,
  };
  const receipt: TrainReceipt = { ...withoutDigest, evidenceDigest: digest(withoutDigest) };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 30);
  return receipt;
}

export function readCompetitiveProductTrainEvidence() {
  const receipts = readDurableReceipts<TrainReceipt>(RECEIPT_PATH, STORE_SCHEMA_VERSION);
  const current = buildCompetitiveProductTrainState();
  const latest = receipts[0] || null;
  return {
    ok: true as const,
    schemaVersion: COMPETITIVE_PRODUCT_TRAIN_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...current,
    latest: latest?.stateDigest === current.stateDigest ? latest : null,
    latestPassing: receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    receiptPath: RECEIPT_PATH,
  };
}
