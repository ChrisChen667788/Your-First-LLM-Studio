import type { ExperimentLinkReference } from "@/features/experiments/contracts";

export function resolveExperimentLinkHref(link: ExperimentLinkReference) {
  const id = encodeURIComponent(link.id);
  switch (link.entityType) {
    case "compare":
      return `/compare?runId=${id}`;
    case "benchmark":
    case "report":
      return `/benchmarks?runId=${id}`;
    case "finetune":
    case "job":
    case "operation":
    case "adapter":
    case "dataset":
    case "recipe":
      return `/fine-tune?entity=${link.entityType}&id=${id}`;
    case "retrieval":
    case "document":
      return `/retrieval?entity=${link.entityType}&id=${id}`;
    case "model":
      return `/models?candidateId=${id}`;
    case "provider":
    case "target":
      return `/admin?targetId=${id}`;
    case "session":
      return `/agent?sessionId=${id}`;
    default:
      return null;
  }
}
