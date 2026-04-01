import {
  configApiRef,
  useApi,
  useRouteRef,
} from "@backstage/frontend-plugin-api";

export function f() {
  useApi(configApiRef);
}
