export const EXTENSION_REGISTRY_SCHEMA_VERSION = "extensions.registry.v1" as const;

export type ExtensionPermission =
  | "model:invoke"
  | "retrieval:read"
  | "workspace:read"
  | "workspace:write"
  | "command:execute"
  | "network:access"
  | "secret:read";

export type ExtensionManifest = {
  schemaVersion: "first-llm-extension.v1";
  id: string;
  name: string;
  version: string;
  publisher: string;
  kind: "mcp-server" | "tool" | "skill" | "provider" | "template";
  entrypoint: string;
  permissions: ExtensionPermission[];
  compatibleStudio: string;
  dependencies?: Record<string, string>;
  digest?: string;
  signature?: string;
};

export type ExtensionTrustPolicy = {
  requireSignatureForCommunity: boolean;
  requireDigest: boolean;
  confirmationPermissions: ExtensionPermission[];
  deniedPermissions: ExtensionPermission[];
};

export function readExtensionTrustPolicy(): ExtensionTrustPolicy {
  return {
    requireSignatureForCommunity: true,
    requireDigest: true,
    confirmationPermissions: ["workspace:write", "command:execute", "network:access", "secret:read"],
    deniedPermissions: [],
  };
}

export function validateExtensionManifest(
  manifest: ExtensionManifest,
  policy: ExtensionTrustPolicy,
) {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (manifest.schemaVersion !== "first-llm-extension.v1") errors.push("Unsupported manifest schema.");
  if (!/^[a-z0-9][a-z0-9.-]+$/.test(manifest.id)) errors.push("Extension id is invalid.");
  if (!/^\d+\.\d+\.\d+([+-][a-z0-9.-]+)?$/i.test(manifest.version)) errors.push("Version must be semver.");
  if (policy.requireDigest && !manifest.digest) errors.push("Package digest is required.");
  if (policy.requireSignatureForCommunity && manifest.publisher !== "first-llm-studio" && !manifest.signature) {
    errors.push("Community extensions require a signature.");
  }
  const denied = manifest.permissions.filter((permission) => policy.deniedPermissions.includes(permission));
  if (denied.length) errors.push(`Denied permissions requested: ${denied.join(", ")}`);
  const confirmation = manifest.permissions.filter((permission) =>
    policy.confirmationPermissions.includes(permission),
  );
  if (confirmation.length) warnings.push(`Explicit confirmation required: ${confirmation.join(", ")}`);
  return { valid: errors.length === 0, errors, warnings, confirmationPermissions: confirmation };
}

export function readExtensionRegistryFoundation() {
  const policy = readExtensionTrustPolicy();
  const builtins: ExtensionManifest[] = [
    {
      schemaVersion: "first-llm-extension.v1",
      id: "first-llm-studio.repo-tools",
      name: "Repository tools",
      version: "1.0.0",
      publisher: "first-llm-studio",
      kind: "tool",
      entrypoint: "features/agent/tool-registry-panel",
      permissions: ["workspace:read", "workspace:write", "command:execute"],
      compatibleStudio: ">=1.0.0",
      digest: "builtin",
      signature: "builtin-trust-root",
    },
    {
      schemaVersion: "first-llm-extension.v1",
      id: "first-llm-studio.retrieval",
      name: "Retrieval tools",
      version: "1.0.0",
      publisher: "first-llm-studio",
      kind: "mcp-server",
      entrypoint: "features/retrieval",
      permissions: ["retrieval:read", "model:invoke"],
      compatibleStudio: ">=1.0.0",
      digest: "builtin",
      signature: "builtin-trust-root",
    },
  ];
  return {
    ok: true as const,
    schemaVersion: EXTENSION_REGISTRY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    policy,
    packages: builtins.map((manifest) => ({
      manifest,
      validation: validateExtensionManifest(manifest, policy),
      source: "builtin" as const,
      state: "enabled" as const,
    })),
    capabilities: ["manifest-validation", "permission-review", "signature-policy", "rollback-contract", "dependency-contract"],
    blockers: ["Community installation remains disabled until an accepted package is unpacked and passes the process sandbox rehearsal."],
  };
}
