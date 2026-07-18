export const ARTIFACT_PACKAGE_SCHEMA_VERSION = "artifacts.package.v1" as const;

export type ArtifactPackageKind =
  | "model"
  | "adapter"
  | "dataset"
  | "rag"
  | "evaluation"
  | "runtime-profile"
  | "workflow";

export type ArtifactPackageFile = {
  path: string;
  role: "manifest" | "config" | "weights" | "data" | "report" | "evidence" | "license";
  sha256: string;
  bytes: number;
};

export type ArtifactPackageManifest = {
  schemaVersion: typeof ARTIFACT_PACKAGE_SCHEMA_VERSION;
  id: string;
  version: string;
  kind: ArtifactPackageKind;
  publisher: string;
  createdAt: string;
  license: string;
  compatibleStudio: string;
  dependencies: Array<{ id: string; version: string; digest?: string }>;
  files: ArtifactPackageFile[];
  evidenceUris: string[];
  digest?: string;
  signature?: string;
};

export function validateArtifactPackage(manifest: ArtifactPackageManifest) {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!manifest.id.trim()) errors.push("Artifact id is required.");
  if (!/^\d+\.\d+\.\d+([+-][a-z0-9.-]+)?$/i.test(manifest.version)) {
    errors.push("Artifact version must be semver.");
  }
  if (!manifest.license.trim()) errors.push("License is required.");
  if (!manifest.files.some((file) => file.role === "manifest")) {
    errors.push("Package must contain a manifest file.");
  }
  if (!manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256) || file.sha256 === "contract-example")) {
    errors.push("Every package file requires a SHA-256 digest.");
  }
  if (!manifest.digest) warnings.push("Package digest has not been materialized yet.");
  if (!manifest.signature) warnings.push("Package signature has not been materialized yet.");
  if (!manifest.evidenceUris.length) warnings.push("No reproducible evidence is linked.");
  return { valid: errors.length === 0, errors, warnings };
}

export function readArtifactPackageFoundation() {
  const example: ArtifactPackageManifest = {
    schemaVersion: ARTIFACT_PACKAGE_SCHEMA_VERSION,
    id: "first-llm-studio.adapter-example",
    version: "1.0.0",
    kind: "adapter",
    publisher: "first-llm-studio",
    createdAt: new Date().toISOString(),
    license: "Apache-2.0",
    compatibleStudio: ">=1.0.0",
    dependencies: [{ id: "base-model", version: "pinned", digest: "required-at-export" }],
    files: [
      { path: "manifest.json", role: "manifest", sha256: "contract-example", bytes: 0 },
      { path: "model-card.md", role: "report", sha256: "contract-example", bytes: 0 },
      { path: "training-config.json", role: "config", sha256: "contract-example", bytes: 0 },
    ],
    evidenceUris: ["docs/release-evidence/finetune-qwen4b-lora-2026-07-01"],
  };
  return {
    ok: true as const,
    schemaVersion: ARTIFACT_PACKAGE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    supportedKinds: ["model", "adapter", "dataset", "rag", "evaluation", "runtime-profile", "workflow"] as ArtifactPackageKind[],
    requiredChecks: ["digest", "signature", "license", "dependency-pin", "secret-scan", "compatibility", "evidence"],
    example: { manifest: example, validation: validateArtifactPackage(example) },
    blockers: ["Local signed publication is available; remote registry promotion remains disabled until a staging round-trip receipt verifies digest and signature."],
  };
}
