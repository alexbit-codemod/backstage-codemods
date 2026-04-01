import {
  createRouteRef,
  createSubRouteRef,
  createExternalRouteRef,
} from "@backstage/core-plugin-api";

export const rootRouteRef = createRouteRef({ id: "my-plugin" });

export const detailsRouteRef = createSubRouteRef({
  id: "my-plugin-details",
  parent: rootRouteRef,
  path: "details/:id/",
});

export const docsRouteRef = createExternalRouteRef({ id: "docs" });
