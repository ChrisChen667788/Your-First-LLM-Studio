export const MODELS_CONTRACT_VERSION = "models.contract.v1" as const;

export type ModelsContractVersion = typeof MODELS_CONTRACT_VERSION;

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
