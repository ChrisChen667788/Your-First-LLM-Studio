export const MODELS_CONTRACT_VERSION = "models.contract.v1" as const;
export const MODEL_RUNTIME_OPERATIONS_CONTRACT_VERSION =
  "models.runtime-operations.v2" as const;

export type ModelsContractVersion = typeof MODELS_CONTRACT_VERSION;
export type ModelRuntimeOperationsContractVersion =
  typeof MODEL_RUNTIME_OPERATIONS_CONTRACT_VERSION;

export type ModelsRouteOwner = {
  route: string;
  owner: "features/models";
  adminOnly?: boolean;
};

export const MODELS_ROUTE_OWNERS: ModelsRouteOwner[] = [
  {
    route: "/models",
    owner: "features/models",
  },
  {
    route: "/admin",
    owner: "features/models",
    adminOnly: true,
  },
];

export type ModelCatalogWorkflowStep =
  | "discover"
  | "preflight"
  | "install"
  | "verify"
  | "cleanup";

export type ModelCatalogWorkflowContract = {
  contractVersion: ModelsContractVersion;
  route: "/models";
  owner: "features/models";
  steps: ModelCatalogWorkflowStep[];
  adminMirror: "/admin";
};

export const MODEL_CATALOG_WORKFLOW_CONTRACT: ModelCatalogWorkflowContract = {
  contractVersion: MODELS_CONTRACT_VERSION,
  route: "/models",
  owner: "features/models",
  steps: ["discover", "preflight", "install", "verify", "cleanup"],
  adminMirror: "/admin",
};

export type ModelRuntimeOperationCapability =
  | "runtime-profiles"
  | "request-logs"
  | "idle-unload"
  | "developer-api"
  | "openai-compatible-server"
  | "token-accounting"
  | "latency-evidence"
  | "server-actions";

export type ModelRuntimeDeveloperApiGuide = {
  endpoint: string;
  chatCompletionsUrl: string;
  modelsUrl: string;
  apiKeyEnv: string;
  keyStatus: "configured" | "missing" | "not-required";
  curlExample: string;
  openaiSdkExample: string;
  tokenAccountingFields: string[];
  latencyFields: string[];
};
