import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";

export const V16_FEATURE_OWNERSHIP_SCHEMA_VERSION =
  "experiments.v16-feature-ownership.v1" as const;

type V16CheckId =
  | "finetune-route"
  | "finetune-shell"
  | "finetune-panel"
  | "finetune-setup-composer"
  | "finetune-run-composer"
  | "finetune-evidence-composer"
  | "finetune-benchmark-handoff"
  | "compare-benchmark-handoff"
  | "compare-progress-get"
  | "compare-progress-post"
  | "compare-progress-compatibility"
  | "compare-route-mode-port"
  | "compare-copy-contract"
  | "architecture-budget"
  | "canonical-route-contracts";

export type V16FeatureOwnershipSlice = {
  id: V16CheckId;
  version: "v1.6.0";
  label: string;
  status: "pass" | "hold";
  summary: string;
};

export type V16FeatureOwnershipReceipt = {
  id: string;
  generatedAt: string;
  status: "pass" | "hold";
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  slices: V16FeatureOwnershipSlice[];
  totals: { slices: 15; passed: number; held: number };
  productionBlockers: string[];
  evidenceDigest: string;
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
const STORE_FILE = path.join(DATA_DIR, "v1.6-feature-ownership.json");

function source(relativePath: string) {
  const absolutePath = path.join(process.cwd(), relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}

function missing(relativePath: string) {
  return !existsSync(path.join(process.cwd(), relativePath));
}

function slice(
  id: V16CheckId,
  label: string,
  passed: boolean,
  summary: string,
): V16FeatureOwnershipSlice {
  return {
    id,
    version: "v1.6.0",
    label,
    status: passed ? "pass" : "hold",
    summary,
  };
}

export function evaluateV16FeatureOwnership() {
  const fineTuneRoute = source("app/fine-tune/page.tsx");
  const fineTuneShell = source("features/finetune/FineTuneStudioShell.tsx");
  const fineTunePanel = source("features/finetune/FineTuneStudioPanel.tsx");
  const fineTuneSetup = source("features/finetune/composers/FineTuneSetupComposer.tsx");
  const fineTuneRun = source("features/finetune/composers/FineTuneRunModesComposer.tsx");
  const fineTuneEvidence = source("features/finetune/composers/FineTuneEvidenceComposer.tsx");
  const fineTuneHandoff = source("features/finetune/adapter-orchestration-actions.ts");
  const compareActions = source("features/compare/actions.ts");
  const compareProgressRoute = source("app/api/compare/progress/route.ts");
  const compareProgressApplication = source("features/compare/progress-application.ts");
  const legacyProgressRoute = source("app/api/agent/compare/progress/route.ts");
  const compareRoute = source("features/compare/CompareRouteWorkbench.tsx");
  const compareWorkbench = source("features/compare/CompareWorkbench.tsx");
  const architectureBudget = source("architecture-budgets.json");
  const benchmarkRoute = source("app/api/benchmarks/route.ts");

  return [
    slice(
      "finetune-route",
      "Fine-tune route ownership",
      fineTuneRoute.includes("@/features/finetune/FineTuneStudioShell") &&
        !fineTuneRoute.includes("AdminFineTunePanel"),
      "The foreground route imports the feature-owned shell directly.",
    ),
    slice(
      "finetune-shell",
      "Fine-tune shell ownership",
      fineTuneShell.includes("FineTuneStudioPanel") &&
        missing("components/finetune/FineTuneStudioShell.tsx"),
      "The product shell is physically owned by features/finetune.",
    ),
    slice(
      "finetune-panel",
      "Fine-tune panel ownership",
      fineTunePanel.includes("@/features/finetune/composers") &&
        missing("components/finetune/FineTuneStudioPanel.tsx"),
      "The foreground composition panel no longer lives under shared components.",
    ),
    slice(
      "finetune-setup-composer",
      "Setup composer ownership",
      fineTuneSetup.includes("export function FineTuneSetupComposer"),
      "Setup composition is physically feature-owned.",
    ),
    slice(
      "finetune-run-composer",
      "Run composer ownership",
      fineTuneRun.includes("export function FineTuneRunModesComposer"),
      "Run-mode composition is physically feature-owned.",
    ),
    slice(
      "finetune-evidence-composer",
      "Evidence composer ownership",
      fineTuneEvidence.includes("export function FineTuneEvidenceComposer"),
      "Evidence and report composition is physically feature-owned.",
    ),
    slice(
      "finetune-benchmark-handoff",
      "Fine-tune Benchmark handoff",
      fineTuneHandoff.includes("BENCHMARK_RUN_API_PATH") &&
        !fineTuneHandoff.includes("/api/admin/benchmark"),
      "Fine-tune sends product handoffs through the canonical Benchmark API.",
    ),
    slice(
      "compare-benchmark-handoff",
      "Compare Benchmark handoff",
      compareActions.includes("BENCHMARK_RUN_API_PATH") &&
        !compareActions.includes("/api/admin/benchmark"),
      "Compare sends product handoffs through the canonical Benchmark API.",
    ),
    slice(
      "compare-progress-get",
      "Compare progress read port",
      compareProgressRoute.includes("progress-application") &&
        compareProgressApplication.includes("export async function GET"),
      "Canonical progress reads are implemented by the feature application.",
    ),
    slice(
      "compare-progress-post",
      "Compare progress write port",
      compareProgressRoute.includes("GET, POST") &&
        compareProgressApplication.includes("export async function POST"),
      "Canonical progress updates are implemented by the same feature application.",
    ),
    slice(
      "compare-progress-compatibility",
      "Compare compatibility wrapper",
      legacyProgressRoute.includes("progress-application") &&
        legacyProgressRoute.split("\n").filter(Boolean).length <= 3,
      "The historical Agent progress route is a thin compatibility re-export.",
    ),
    slice(
      "compare-route-mode-port",
      "Compare foreground mode port",
      compareRoute.includes("activateCompareMode") &&
        !compareRoute.includes("AgentWorkbenchMode"),
      "The foreground Compare route no longer creates Agent workbench mode state.",
    ),
    slice(
      "compare-copy-contract",
      "Compare product copy contract",
      compareWorkbench.includes("/api/benchmarks") &&
        !compareWorkbench.includes("/api/admin/benchmark"),
      "Compare UI describes the canonical product endpoint.",
    ),
    slice(
      "architecture-budget",
      "Architecture budget alignment",
      architectureBudget.includes("features/finetune/FineTuneStudioPanel.tsx") &&
        !architectureBudget.includes("components/finetune/FineTuneStudioPanel.tsx"),
      "The architecture budget tracks the physical feature owner.",
    ),
    slice(
      "canonical-route-contracts",
      "Canonical route contracts",
      benchmarkRoute.includes("features/benchmark/run-application") &&
        benchmarkRoute.includes("benchmark.run-route.v1") &&
        compareProgressRoute.includes("features/compare/progress-application"),
      "Benchmark run and Compare progress expose stable product-facing routes.",
    ),
  ];
}

export function runV16FeatureOwnershipAcceptance() {
  const slices = evaluateV16FeatureOwnership();
  const passed = slices.filter((entry) => entry.status === "pass").length;
  const evidenceDigest = createHash("sha256")
    .update(JSON.stringify(slices.map(({ id, status }) => ({ id, status }))))
    .digest("hex");
  const receipt: V16FeatureOwnershipReceipt = {
    id: `v16-feature-ownership-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    status: passed === 15 ? "pass" : "hold",
    localStatus: passed === 15 ? "pass" : "hold",
    productionStatus: "hold",
    slices,
    totals: { slices: 15, passed, held: 15 - passed },
    productionBlockers: [
      "Feature ownership closure is local architecture evidence, not cloud production sign-off.",
      "Managed multi-node failover, cloud KMS/archive, external IdP/SCIM, and organization acceptance remain HOLD.",
    ],
    evidenceDigest,
  };
  prependDurableReceipt(
    STORE_FILE,
    V16_FEATURE_OWNERSHIP_SCHEMA_VERSION,
    receipt,
    100,
  );
  return receipt;
}

export function readV16FeatureOwnershipEvidence() {
  const receipts = readDurableReceipts<V16FeatureOwnershipReceipt>(
    STORE_FILE,
    V16_FEATURE_OWNERSHIP_SCHEMA_VERSION,
  );
  const latest = receipts[0] || null;
  return {
    ok: true as const,
    schemaVersion: V16_FEATURE_OWNERSHIP_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localStatus: latest?.localStatus || ("evidence-needed" as const),
    productionStatus: "hold" as const,
    latest,
    latestPassing:
      receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    totals: latest?.totals || { slices: 15 as const, passed: 0, held: 15 },
    productionBlockers: latest?.productionBlockers || [
      "v1.6 feature ownership acceptance has not been run.",
    ],
    path: STORE_FILE,
  };
}
