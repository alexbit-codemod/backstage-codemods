/** Legacy package for the old Backstage frontend plugin system */
export const CORE_PLUGIN_API = "@backstage/core-plugin-api";

/** New frontend plugin / extension API */
export const FRONTEND_PLUGIN_API = "@backstage/frontend-plugin-api";

/** Known external route ref id → defaultTarget for full NFS migration */
export const EXTERNAL_ROUTE_DEFAULT_TARGETS: Readonly<Record<string, string>> = {
  docs: "techdocs.docRoot",
  docRoot: "techdocs.docRoot",
  techdocs: "techdocs.docRoot",
  catalogEntity: "catalog.catalogEntity",
  catalog: "catalog.catalogEntity",
  scaffolder: "scaffolder.root",
  root: "scaffolder.root",
  create: "scaffolder.root",
};

export type RiskLevel = "safe" | "medium" | "tricky";
