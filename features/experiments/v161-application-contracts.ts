import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";

export const V161_APPLICATION_CONTRACTS_SCHEMA_VERSION =
  "experiments.v161-application-contracts.v1" as const;

type V161CheckId =
  | "benchmark-baseline-route"
  | "benchmark-progress-read"
  | "benchmark-progress-write"
  | "benchmark-prompt-sets-route"
  | "benchmark-report-route"
  | "benchmark-evidence-route"
  | "benchmark-export-route"
  | "benchmark-studio-prompt-sets"
  | "benchmark-studio-progress"
  | "benchmark-studio-export"
  | "benchmark-run-evidence-uris"
  | "compare-recipes-route"
  | "compare-recipes-client"
  | "legacy-wrappers"
  | "ownership-contracts";

export type V161ApplicationContractSlice = {
  id: V161CheckId;
  version: "v1.6.1";
  label: string;
  status: "pass" | "hold";
  summary: string;
};

export type V161ApplicationContractReceipt = {
  id: string;
  generatedAt: string;
  status: "pass" | "hold";
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  slices: V161ApplicationContractSlice[];
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
const STORE_FILE = path.join(DATA_DIR, "v1.6.1-application-contracts.json");

function source(relativePath: string) {
  const absolutePath = path.join(process.cwd(), relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}

function slice(
  id: V161CheckId,
  label: string,
  passed: boolean,
  summary: string,
): V161ApplicationContractSlice {
  return {
    id,
    version: "v1.6.1",
    label,
    status: passed ? "pass" : "hold",
    summary,
  };
}

function isThinWrapper(relativePath: string, ownerImport: string) {
  const wrapper = source(relativePath);
  return (
    wrapper.includes(ownerImport) &&
    !wrapper.includes("NextResponse") &&
    wrapper.split("\n").filter(Boolean).length <= 10
  );
}

export function evaluateV161ApplicationContracts() {
  const baselineRoute = source("app/api/benchmarks/baseline/route.ts");
  const progressRoute = source("app/api/benchmarks/progress/route.ts");
  const promptSetsRoute = source("app/api/benchmarks/prompt-sets/route.ts");
  const reportRoute = source("app/api/benchmarks/report/route.ts");
  const evidenceRoute = source("app/api/benchmarks/evidence/route.ts");
  const exportRoute = source("app/api/benchmarks/export/route.ts");
  const benchmarkStudio = source("features/benchmark/BenchmarksStudioShell.tsx");
  const runProgress = source("features/benchmark/run-progress.ts");
  const compareRecipesRoute = source("app/api/compare/recipes/route.ts");
  const compareRecipesClient = source("features/compare/recipe-persistence.ts");
  const benchmarkContracts = source("features/benchmark/contracts.ts");
  const compareContracts = source("features/compare/contracts.ts");
  const ownershipMatrix = source("docs/route-module-ownership-matrix.md");

  const legacyWrappers = [
    ["app/api/admin/benchmark/baseline/route.ts", "baseline-application"],
    ["app/api/admin/benchmark/progress/route.ts", "progress-application"],
    ["app/api/admin/benchmark/prompt-sets/route.ts", "prompt-set-application"],
    ["app/api/admin/benchmark/report/route.ts", "report-application"],
    ["app/api/admin/benchmark/evidence/route.ts", "release-evidence-application"],
    ["app/api/admin/benchmark/export/route.ts", "export-application"],
    ["app/api/agent/recipes/route.ts", "recipe-application"],
  ].every(([route, owner]) => isThinWrapper(route, owner));

  return [
    slice(
      "benchmark-baseline-route",
      "Benchmark baseline route",
      baselineRoute.includes("baseline-application") &&
        baselineRoute.includes("GET") &&
        baselineRoute.includes("POST"),
      "Baseline lifecycle is exposed through the product Benchmark namespace.",
    ),
    slice(
      "benchmark-progress-read",
      "Benchmark progress read",
      progressRoute.includes("progress-application") &&
        progressRoute.includes("GET"),
      "Progress polling resolves through the canonical feature application.",
    ),
    slice(
      "benchmark-progress-write",
      "Benchmark progress control",
      progressRoute.includes("progress-application") &&
        progressRoute.includes("POST"),
      "Stop and abandon controls share the canonical progress route.",
    ),
    slice(
      "benchmark-prompt-sets-route",
      "Benchmark prompt-set route",
      promptSetsRoute.includes("prompt-set-application") &&
        promptSetsRoute.includes("DELETE") &&
        promptSetsRoute.includes("PATCH"),
      "Prompt-set CRUD is product-facing and feature-owned.",
    ),
    slice(
      "benchmark-report-route",
      "Benchmark report route",
      reportRoute.includes("report-application") && reportRoute.includes("GET"),
      "Report previews and exports use the canonical Benchmark namespace.",
    ),
    slice(
      "benchmark-evidence-route",
      "Benchmark evidence route",
      evidenceRoute.includes("release-evidence-application") &&
        evidenceRoute.includes("DELETE"),
      "Pinned release evidence is exposed outside the Admin namespace.",
    ),
    slice(
      "benchmark-export-route",
      "Benchmark export route",
      exportRoute.includes("export-application") && exportRoute.includes("GET"),
      "History and issue-summary exports use the canonical product route.",
    ),
    slice(
      "benchmark-studio-prompt-sets",
      "Studio prompt-set client",
      benchmarkStudio.includes("BENCHMARK_PROMPT_SETS_API_PATH") &&
        !benchmarkStudio.includes("/api/admin/benchmark/prompt-sets"),
      "Benchmark Studio no longer loads prompt sets through Admin.",
    ),
    slice(
      "benchmark-studio-progress",
      "Studio progress client",
      benchmarkStudio.includes("BENCHMARK_PROGRESS_API_PATH") &&
        !benchmarkStudio.includes("/api/admin/benchmark/progress"),
      "Benchmark Studio polls the canonical progress route.",
    ),
    slice(
      "benchmark-studio-export",
      "Studio export client",
      benchmarkStudio.includes("BENCHMARK_EXPORT_API_PATH") &&
        !benchmarkStudio.includes("/api/admin/benchmark/export"),
      "Benchmark Studio emits canonical export links.",
    ),
    slice(
      "benchmark-run-evidence-uris",
      "Runner evidence URIs",
      runProgress.includes("BENCHMARK_PROGRESS_API_PATH") &&
        runProgress.includes("BENCHMARK_REPORT_API_PATH") &&
        !runProgress.includes("/api/admin/benchmark/"),
      "Run timeline evidence points at product-owned progress and report routes.",
    ),
    slice(
      "compare-recipes-route",
      "Compare recipes route",
      compareRecipesRoute.includes("recipe-application") &&
        compareRecipesRoute.includes("PUT") &&
        compareRecipesRoute.includes("DELETE"),
      "Recipe persistence has a Compare-owned product route.",
    ),
    slice(
      "compare-recipes-client",
      "Compare recipes client",
      compareRecipesClient.includes("COMPARE_RECIPES_API_PATH") &&
        !compareRecipesClient.includes("/api/agent/recipes"),
      "Compare persistence no longer depends on the Agent namespace.",
    ),
    slice(
      "legacy-wrappers",
      "Legacy wrapper thickness",
      legacyWrappers,
      "Seven historical Admin/Agent routes contain only runtime metadata and feature re-exports.",
    ),
    slice(
      "ownership-contracts",
      "Contracts and ownership matrix",
      benchmarkContracts.includes("BENCHMARK_EXPORT_API_PATH") &&
        compareContracts.includes("COMPARE_RECIPES_API_PATH") &&
        ownershipMatrix.includes("/api/benchmarks/evidence") &&
        ownershipMatrix.includes("/api/compare/recipes"),
      "Code constants and the ownership matrix describe the same application boundary.",
    ),
  ];
}

export function runV161ApplicationContractsAcceptance() {
  const slices = evaluateV161ApplicationContracts();
  const passed = slices.filter((entry) => entry.status === "pass").length;
  const evidenceDigest = createHash("sha256")
    .update(JSON.stringify(slices.map(({ id, status }) => ({ id, status }))))
    .digest("hex");
  const receipt: V161ApplicationContractReceipt = {
    id: `v161-application-contracts-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    status: passed === 15 ? "pass" : "hold",
    localStatus: passed === 15 ? "pass" : "hold",
    productionStatus: "hold",
    slices,
    totals: { slices: 15, passed, held: 15 - passed },
    productionBlockers: [
      "Canonical application routes are local architecture evidence, not managed production evidence.",
      "External IdP/SCIM, remote worker failover, cloud KMS/archive, and organization acceptance remain HOLD.",
    ],
    evidenceDigest,
  };
  prependDurableReceipt(
    STORE_FILE,
    V161_APPLICATION_CONTRACTS_SCHEMA_VERSION,
    receipt,
    100,
  );
  return receipt;
}

export function readV161ApplicationContractsEvidence() {
  const receipts = readDurableReceipts<V161ApplicationContractReceipt>(
    STORE_FILE,
    V161_APPLICATION_CONTRACTS_SCHEMA_VERSION,
  );
  const latest = receipts[0] || null;
  return {
    ok: true as const,
    schemaVersion: V161_APPLICATION_CONTRACTS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localStatus: latest?.localStatus || ("evidence-needed" as const),
    productionStatus: "hold" as const,
    latest,
    latestPassing:
      receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    totals: latest?.totals || { slices: 15 as const, passed: 0, held: 15 },
    productionBlockers: latest?.productionBlockers || [
      "v1.6.1 application contract acceptance has not been run.",
    ],
    path: STORE_FILE,
  };
}
