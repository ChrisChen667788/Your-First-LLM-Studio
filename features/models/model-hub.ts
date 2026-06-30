export const MODEL_HUB_ROUTE = "/models" as const;
export const MODEL_HUB_RUNTIME_ROUTE = "/models/runtime" as const;

export type ModelHubSection =
  | "runtime"
  | "catalog"
  | "install"
  | "verification";

export const MODEL_HUB_SECTIONS: ModelHubSection[] = [
  "runtime",
  "catalog",
  "install",
  "verification",
];

export function getModelHubRuntimeHandoff() {
  return {
    sourceRoute: MODEL_HUB_RUNTIME_ROUTE,
    targetRoute: MODEL_HUB_ROUTE,
    status: "merged" as const,
    owner: "features/models" as const,
  };
}
