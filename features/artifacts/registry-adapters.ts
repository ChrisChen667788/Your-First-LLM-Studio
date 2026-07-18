import type { ArtifactPackageManifest } from "@/features/artifacts/package-contract";

export const ARTIFACT_REGISTRY_ADAPTER_SCHEMA_VERSION =
  "artifacts.registry-adapters.v1" as const;

export type ArtifactRegistryTargetId =
  | "github-releases"
  | "modelscope"
  | "huggingface"
  | "private-oci";

type RegistryTarget = {
  id: ArtifactRegistryTargetId;
  label: string;
  status: "preview" | "planned";
  packageKinds: ArtifactPackageManifest["kind"][];
  requiredEnvironment: string[];
  supportsImmutableVersion: boolean;
  supportsDigestVerification: boolean;
};

const TARGETS: RegistryTarget[] = [
  {
    id: "github-releases",
    label: "GitHub Releases",
    status: "preview",
    packageKinds: ["adapter", "evaluation", "runtime-profile", "workflow"],
    requiredEnvironment: ["GITHUB_TOKEN", "GITHUB_REPOSITORY"],
    supportsImmutableVersion: true,
    supportsDigestVerification: true,
  },
  {
    id: "modelscope",
    label: "ModelScope Hub",
    status: "preview",
    packageKinds: ["model", "adapter", "dataset", "evaluation"],
    requiredEnvironment: ["MODELSCOPE_API_TOKEN", "MODELSCOPE_REPOSITORY"],
    supportsImmutableVersion: true,
    supportsDigestVerification: true,
  },
  {
    id: "huggingface",
    label: "Hugging Face Hub",
    status: "preview",
    packageKinds: ["model", "adapter", "dataset", "evaluation"],
    requiredEnvironment: ["HF_TOKEN", "HF_REPOSITORY"],
    supportsImmutableVersion: true,
    supportsDigestVerification: true,
  },
  {
    id: "private-oci",
    label: "Private OCI Registry",
    status: "planned",
    packageKinds: ["model", "adapter", "rag", "runtime-profile", "workflow"],
    requiredEnvironment: ["OCI_REGISTRY", "OCI_REPOSITORY", "OCI_IDENTITY"],
    supportsImmutableVersion: true,
    supportsDigestVerification: true,
  },
];

function coordinate(manifest: ArtifactPackageManifest) {
  const safeId = manifest.id.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  return `${safeId}:${manifest.version}`;
}

export function buildArtifactRegistryPublishPlan(input: {
  targetId: ArtifactRegistryTargetId;
  manifest: ArtifactPackageManifest;
}) {
  const target = TARGETS.find((candidate) => candidate.id === input.targetId);
  if (!target) throw new Error("Unknown artifact registry target.");
  const blockers = [
    ...(!target.packageKinds.includes(input.manifest.kind)
      ? [`${target.label} does not declare ${input.manifest.kind} packages.`]
      : []),
    ...(!input.manifest.digest ? ["The package digest must be materialized before staging."] : []),
    ...(!input.manifest.signature ? ["The package signature must be materialized before staging."] : []),
    ...(target.status !== "preview" ? [`${target.label} does not have a staging adapter yet.`] : []),
  ];
  return {
    schemaVersion: ARTIFACT_REGISTRY_ADAPTER_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    target,
    coordinate: coordinate(input.manifest),
    artifact: {
      id: input.manifest.id,
      version: input.manifest.version,
      kind: input.manifest.kind,
      digest: input.manifest.digest || null,
      signaturePresent: Boolean(input.manifest.signature),
    },
    planReady: blockers.length === 0,
    executable: false,
    blockers,
    requiredEnvironment: target.requiredEnvironment,
    stages: [
      "verify-local-provenance",
      "stage-versioned-package",
      "publish-with-immutable-coordinate",
      "read-back-manifest-and-package",
      "verify-remote-digest-and-signature",
      "persist-round-trip-receipt",
    ],
    safety: {
      secretsReturned: false,
      overwriteLatest: false,
      remoteMutationEnabled: false,
      immutableVersionRequired: true,
    },
  };
}

export function readArtifactRegistryAdapterCatalog() {
  return {
    ok: true as const,
    schemaVersion: ARTIFACT_REGISTRY_ADAPTER_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    targets: TARGETS,
    totals: {
      targets: TARGETS.length,
      preview: TARGETS.filter((target) => target.status === "preview").length,
      planned: TARGETS.filter((target) => target.status === "planned").length,
      digestVerified: TARGETS.filter((target) => target.supportsDigestVerification).length,
    },
    policy: {
      localRegistryIsCanonicalStagingSource: true,
      productionPublishRequiresExplicitOperatorAction: true,
      remoteRoundTripReceiptRequired: true,
      previewAdaptersMayMutateRemote: false,
    },
  };
}
