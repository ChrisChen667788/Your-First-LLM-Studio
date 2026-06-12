import type {
  ExperimentArtifactReference,
  ExperimentLinkReference,
  ExperimentSourceContext,
} from "@/features/experiments/contracts";

export function buildExperimentSourceLinks(
  context?: ExperimentSourceContext,
): ExperimentLinkReference[] {
  if (!context) return [];

  const links: ExperimentLinkReference[] = [
    {
      relation: "source",
      entityType: context.sourceKind,
      id: context.sourceId,
      label: context.sourceLabel,
    },
  ];
  if (context.jobId) {
    links.push({ relation: "derived-from", entityType: "job", id: context.jobId });
  }
  if (context.adapterId) {
    links.push({ relation: "uses", entityType: "adapter", id: context.adapterId });
  }
  if (context.datasetId) {
    links.push({ relation: "uses", entityType: "dataset", id: context.datasetId });
  }
  return links;
}

export function inheritExperimentSourceArtifacts(
  context?: ExperimentSourceContext,
): ExperimentArtifactReference[] {
  return context?.artifacts ? [...context.artifacts] : [];
}
