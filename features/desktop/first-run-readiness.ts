import { accessSync, constants, existsSync } from "fs";
import os from "os";
import path from "path";

export const DESKTOP_FIRST_RUN_SCHEMA_VERSION =
  "desktop.first-run-readiness.v1" as const;

export type DesktopDiagnosticStatus = "pass" | "watch" | "blocked";

export type DesktopDiagnosticCheck = {
  id: string;
  label: string;
  status: DesktopDiagnosticStatus;
  summary: string;
  remediation?: string;
};

function writableDirectory(directoryPath: string) {
  try {
    accessSync(directoryPath, constants.R_OK | constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function readDesktopFirstRunReadiness() {
  const modelDataDir =
    process.env.LOCAL_MODEL_DIR || path.join(os.homedir(), ".lmstudio", "models");
  const nodeMajor = Number(process.versions.node.split(".")[0] || 0);
  const checks: DesktopDiagnosticCheck[] = [
    {
      id: "apple-silicon",
      label: "Apple Silicon host",
      status: process.platform === "darwin" && process.arch === "arm64" ? "pass" : "blocked",
      summary: `${process.platform}/${process.arch}`,
      remediation: "Use an Apple Silicon Mac for the supported MLX-first desktop path.",
    },
    {
      id: "node-runtime",
      label: "Node runtime",
      status: nodeMajor >= 22 ? "pass" : "blocked",
      summary: `Node ${process.versions.node}`,
      remediation: "Install Node 22 or newer.",
    },
    {
      id: "model-storage",
      label: "Model storage",
      status: existsSync(modelDataDir)
        ? writableDirectory(modelDataDir)
          ? "pass"
          : "blocked"
        : "watch",
      summary: existsSync(modelDataDir)
        ? `${modelDataDir} is ${writableDirectory(modelDataDir) ? "writable" : "read-only"}`
        : `${modelDataDir} will be created during model acquisition`,
      remediation: "Choose a writable internal or external-disk model directory.",
    },
    {
      id: "signed-desktop-package",
      label: "Signed desktop package",
      status: process.env.FIRST_LLM_DESKTOP_SIGNED_PACKAGE === "1" ? "pass" : "watch",
      summary:
        process.env.FIRST_LLM_DESKTOP_SIGNED_PACKAGE === "1"
          ? "Signed package evidence is configured."
          : "Development web runtime; signed desktop package evidence is not configured.",
    },
    {
      id: "background-service",
      label: "Background runtime service",
      status: process.env.FIRST_LLM_BACKGROUND_SERVICE === "1" ? "pass" : "watch",
      summary:
        process.env.FIRST_LLM_BACKGROUND_SERVICE === "1"
          ? "Background service ownership is configured."
          : "Gateway remains user-started in this development checkout.",
    },
  ];
  return {
    ok: true as const,
    schemaVersion: DESKTOP_FIRST_RUN_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    host: {
      platform: process.platform,
      architecture: process.arch,
      cpuCount: os.cpus().length,
      memoryBytes: os.totalmem(),
      nodeVersion: process.versions.node,
    },
    paths: {
      modelDataDir,
      applicationDataDir:
        process.env.LOCAL_AGENT_DATA_DIR ||
        path.join(os.homedir(), "Library", "Application Support", "local-agent-lab"),
    },
    checks,
    totals: {
      pass: checks.filter((check) => check.status === "pass").length,
      watch: checks.filter((check) => check.status === "watch").length,
      blocked: checks.filter((check) => check.status === "blocked").length,
    },
  };
}
