import {
  createRouteRef,
  createSubRouteRef,
  createExternalRouteRef,
} from "@backstage/frontend-plugin-api";

export const rootRouteRef = createRouteRef();

export const detailsRouteRef = createSubRouteRef({ parent: rootRouteRef, path: "/details/:id" });

export const docsRouteRef = createExternalRouteRef({ defaultTarget: 'techdocs.docRoot' });
