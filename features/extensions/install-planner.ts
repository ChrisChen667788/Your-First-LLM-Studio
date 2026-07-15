import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { resolveExtensionDependencies } from "@/features/extensions/dependency-resolver";
import { readExtensionTrustPolicy, validateExtensionManifest, type ExtensionManifest } from "@/features/extensions/registry";

export const EXTENSION_INSTALL_PLAN_SCHEMA_VERSION = "extensions.install-plan.v1" as const;

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const PLAN_FILE = path.join(DATA_DIR, "extension-install-plans.json");

type InstallPlan = { id: string; createdAt: string; status: "ready" | "blocked"; installOrder: string[]; approvals: Array<{ extensionId: string; permissions: string[] }>; errors: string[]; manifestDigests: Array<{ id: string; digest: string | null }> };

function readPlans(): InstallPlan[] {
  if (!existsSync(PLAN_FILE)) return [];
  try { const parsed = JSON.parse(readFileSync(PLAN_FILE, "utf8")) as { plans?: InstallPlan[] }; return Array.isArray(parsed.plans) ? parsed.plans : []; }
  catch { return []; }
}

function writePlans(plans: InstallPlan[]) {
  mkdirSync(path.dirname(PLAN_FILE), { recursive: true });
  writeFileSync(PLAN_FILE, `${JSON.stringify({ schemaVersion: EXTENSION_INSTALL_PLAN_SCHEMA_VERSION, plans }, null, 2)}\n`, "utf8");
}

export function createExtensionInstallPlan(manifests: ExtensionManifest[]) {
  if (!manifests.length) throw new Error("At least one extension manifest is required.");
  const policy = readExtensionTrustPolicy();
  const validations = manifests.map((manifest) => ({ manifest, validation: validateExtensionManifest(manifest, policy) }));
  const resolution = resolveExtensionDependencies(manifests);
  const errors = [...validations.flatMap((entry) => entry.validation.errors.map((error) => `${entry.manifest.id}: ${error}`)), ...resolution.errors];
  const plan: InstallPlan = {
    id: `extension-plan-${randomUUID()}`,
    createdAt: new Date().toISOString(),
    status: errors.length ? "blocked" : "ready",
    installOrder: resolution.installOrder,
    approvals: validations.filter((entry) => entry.validation.confirmationPermissions.length).map((entry) => ({ extensionId: entry.manifest.id, permissions: entry.validation.confirmationPermissions })),
    errors,
    manifestDigests: manifests.map((manifest) => ({ id: manifest.id, digest: manifest.digest || null })),
  };
  writePlans([plan, ...readPlans()].slice(0, 100));
  return plan;
}

export function readExtensionInstallPlans() {
  const plans = readPlans();
  return { ok: true as const, schemaVersion: EXTENSION_INSTALL_PLAN_SCHEMA_VERSION, generatedAt: new Date().toISOString(), plans, totals: { plans: plans.length, ready: plans.filter((plan) => plan.status === "ready").length, blocked: plans.filter((plan) => plan.status === "blocked").length }, path: PLAN_FILE };
}
