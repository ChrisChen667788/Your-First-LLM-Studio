import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import type {
  PublicReleaseEvidenceFileCheck,
  PublicReleaseEvidenceResponse,
} from "@/features/experiments/contracts";
import { readFineTuneSummary } from "@/lib/finetune/store";

const PUBLIC_RELEASE_EVIDENCE_SCHEMA_VERSION =
  "experiments.public-release-evidence.v1" as const;
const DEMO_CAPTURE_SCHEMA_VERSION =
  "first-llm-studio.demo-capture-manifest.v1" as const;

const DOCS_ROUTE = "/release";
const DOCS_ROUTE_FILE = path.join(process.cwd(), "app", "release", "page.tsx");
const DEMO_CAPTURE_MANIFEST_PATH = path.join(
  process.cwd(),
  "docs",
  "demo-capture-manifest.json",
);

const REQUIRED_PUBLIC_DOC_FILES = [
  {
    label: "Release train",
    relativePath: "docs/next-10-release-train.md",
    minBytes: 1000,
  },
  {
    label: "Open source backlog",
    relativePath: "docs/open-source-backlog.md",
    minBytes: 1000,
  },
  {
    label: "Launch kit",
    relativePath: "docs/open-source-launch-kit.md",
    minBytes: 1000,
  },
  {
    label: "v0.4.2 release note",
    relativePath: "docs/releases/v0.4.2_2026-07-02.md",
    minBytes: 1000,
  },
] as const;

type DemoCaptureManifest = {
  schemaVersion?: string;
  flows?: Array<{
    id?: string;
    label?: string;
    route?: string;
    screenshotPath?: string;
    command?: string;
    purpose?: string;
  }>;
};

function clampPct(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function readJsonFile(filePath: string): DemoCaptureManifest | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as DemoCaptureManifest;
  } catch {
    return null;
  }
}

function isGitLfsPointer(filePath: string) {
  try {
    const prefix = readFileSync(filePath).subarray(0, 128).toString("utf8");
    return prefix.startsWith("version https://git-lfs.github.com/spec/");
  } catch {
    return false;
  }
}

function checkFile(input: {
  label: string;
  relativePath: string;
  minBytes: number;
}): PublicReleaseEvidenceFileCheck {
  const filePath = path.join(process.cwd(), input.relativePath);
  if (!existsSync(filePath)) {
    return {
      ...input,
      exists: false,
      sizeBytes: 0,
      updatedAt: null,
      lfsPointer: false,
      ok: false,
    };
  }
  try {
    const stats = statSync(filePath);
    const lfsPointer = isGitLfsPointer(filePath);
    return {
      ...input,
      exists: true,
      sizeBytes: stats.size,
      updatedAt: new Date(stats.mtimeMs).toISOString(),
      lfsPointer,
      ok: !lfsPointer && stats.size >= input.minBytes,
    };
  } catch {
    return {
      ...input,
      exists: false,
      sizeBytes: 0,
      updatedAt: null,
      lfsPointer: false,
      ok: false,
    };
  }
}

function buildDemoCapture() {
  const manifestExists = existsSync(DEMO_CAPTURE_MANIFEST_PATH);
  const manifest = manifestExists ? readJsonFile(DEMO_CAPTURE_MANIFEST_PATH) : null;
  const flows = (manifest?.flows || []).map((flow, index) => {
    const screenshotPath = flow.screenshotPath || "";
    const screenshot = checkFile({
      label: `${flow.label || flow.id || `Demo flow ${index + 1}`} screenshot`,
      relativePath: screenshotPath || "__missing-demo-screenshot__",
      minBytes: 150_000,
    });
    const id = flow.id || `demo-flow-${index + 1}`;
    const label = flow.label || id;
    const route = flow.route || "";
    const command = flow.command || "";
    const purpose = flow.purpose || "";
    const ok = Boolean(route && command && purpose && screenshotPath && screenshot.ok);
    return {
      id,
      label,
      route,
      screenshotPath,
      command,
      purpose,
      screenshot,
      ok,
    };
  });
  return {
    manifestPath: path.relative(process.cwd(), DEMO_CAPTURE_MANIFEST_PATH),
    manifestExists,
    schemaVersion: manifest?.schemaVersion || null,
    flowCount: flows.length,
    verifiedFlowCount: flows.filter((flow) => flow.ok).length,
    flows,
    ok:
      manifestExists &&
      manifest?.schemaVersion === DEMO_CAPTURE_SCHEMA_VERSION &&
      flows.length > 0 &&
      flows.every((flow) => flow.ok),
  };
}

function buildDistillationEvidence() {
  const summary = readFineTuneSummary();
  const distillationOperations = summary.operations
    .filter((operation) => operation.kind === "distillation")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const completedOperations = distillationOperations.filter(
    (operation) => operation.status === "completed",
  );
  const latest = completedOperations[0] || distillationOperations[0] || null;
  const artifactByLabel = (pattern: RegExp) =>
    latest?.artifacts.find((artifact) => pattern.test(artifact.label) || pattern.test(artifact.filePath));
  const manifestArtifact = artifactByLabel(/manifest/i);
  const datasetArtifact = artifactByLabel(/dataset|jsonl/i);
  const reportArtifact = artifactByLabel(/report/i);
  return {
    operationCount: distillationOperations.length,
    completedOperationCount: completedOperations.length,
    latestOperationId: latest?.id || null,
    latestDatasetId: latest?.datasetId || null,
    latestManifestPath: manifestArtifact?.filePath || null,
    latestDatasetPath: datasetArtifact?.filePath || null,
    latestReportPath: reportArtifact?.filePath || null,
    ok: completedOperations.length > 0 && Boolean(manifestArtifact && datasetArtifact && reportArtifact),
  };
}

export function readPublicReleaseEvidence(): PublicReleaseEvidenceResponse {
  const docsRoute = {
    route: DOCS_ROUTE,
    filePath: path.relative(process.cwd(), DOCS_ROUTE_FILE),
    exists: existsSync(DOCS_ROUTE_FILE),
    ok: existsSync(DOCS_ROUTE_FILE),
  };
  const docsFiles = REQUIRED_PUBLIC_DOC_FILES.map(checkFile);
  const demoCapture = buildDemoCapture();
  const distillation = buildDistillationEvidence();
  const blockers = [
    ...(docsRoute.ok ? [] : [`Public docs route file is missing: ${docsRoute.filePath}.`]),
    ...docsFiles
      .filter((file) => !file.ok)
      .map((file) =>
        file.exists
          ? `${file.label} does not meet the public docs evidence threshold (${file.sizeBytes}/${file.minBytes} bytes).`
          : `Missing public docs evidence file: ${file.relativePath}.`,
      ),
    ...(demoCapture.ok
      ? []
      : [
          demoCapture.manifestExists
            ? "Demo capture manifest exists but one or more flows are incomplete or missing high-resolution screenshots."
            : "Demo capture manifest is missing.",
        ]),
    ...(distillation.ok
      ? []
      : ["No completed distillation operation with dataset, report, and manifest artifacts is available."]),
  ];
  const checks = [
    docsRoute.ok,
    ...docsFiles.map((file) => file.ok),
    demoCapture.ok,
    distillation.ok,
  ];
  const passingCheckCount = checks.filter(Boolean).length;

  return {
    ok: true,
    schemaVersion: PUBLIC_RELEASE_EVIDENCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    docsRoute,
    docsFiles,
    demoCapture,
    distillation,
    totals: {
      checkCount: checks.length,
      passingCheckCount,
      blockerCount: blockers.length,
      completionPct: clampPct((passingCheckCount / Math.max(1, checks.length)) * 100),
    },
    blockers,
    releaseNoteDraft: [
      `Public release docs route ${docsRoute.ok ? "is available" : "is missing"} at ${DOCS_ROUTE}.`,
      `Demo capture verifies ${demoCapture.verifiedFlowCount}/${demoCapture.flowCount} flow(s).`,
      `Distillation evidence includes ${distillation.completedOperationCount} completed operation(s).`,
    ],
  };
}
