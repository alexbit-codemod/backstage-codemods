import { useApi, useRouteRef, configApiRef } from "@backstage/core-plugin-api";

export function f() {
  useApi(configApiRef);
}
