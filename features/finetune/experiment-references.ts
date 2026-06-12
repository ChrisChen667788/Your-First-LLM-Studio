import type {
  ExperimentArtifactReference,
  ExperimentLinkReference,
} from "@/features/experiments/contracts";

type FineTuneOperationReferenceInput = {
  id: string;
  adapterId?: string;
  jobId?: string;
  datasetId?: string;
  artifacts?: Array<{
    filePath: string;
    label: string;
    mediaType?: string;
  }>;
};

function inferArtifactRole(
  label: string,
): ExperimentArtifactReference["role"] {
  const normalized = label.toLowerCase();
  if (normalized.includes("report") || normalized.includes("card")) return "report";
  if (normalized.includes("manifest")) return "manifest";
  if (normalized.includes("dataset") || normalized.includes("prediction")) return "dataset";
  if (normalized.includes("adapter") || normalized.includes("model")) return "adapter";
  if (normalized.includes("log") || normalized.includes("transcript")) return "log";
  return "output";
}

export function buildFineTuneOperationEventReferences(
  operation: FineTuneOperationReferenceInput,
): {
  artifacts: ExperimentArtifactReference[];
  links: ExperimentLinkReference[];
} {
  const artifacts = (operation.artifacts || []).map((artifact) => ({
    kind: "file" as const,
    role: inferArtifactRole(artifact.label),
    label: artifact.label,
    uri: artifact.filePath,
    mimeType: artifact.mediaType,
  }));
  const links: ExperimentLinkReference[] = [
    {
      relation: "produced",
      entityType: "operation",
      id: operation.id,
    },
  ];
  if (operation.jobId) {
    links.push({ relation: "derived-from", entityType: "job", id: operation.jobId });
  }
  if (operation.adapterId) {
    links.push({ relation: "uses", entityType: "adapter", id: operation.adapterId });
  }
  if (operation.datasetId) {
    links.push({ relation: "uses", entityType: "dataset", id: operation.datasetId });
  }

  return { artifacts, links };
}
