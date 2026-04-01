import { useApi, useRouteRef, configApiRef } from "@backstage/frontend-plugin-api";

export function f() {
  useApi(configApiRef);
}
