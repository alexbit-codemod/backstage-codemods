import {
  createApiFactory,
  createApiRef,
  discoveryApiRef,
} from "@backstage/core-plugin-api";

export const myPluginApiRef = createApiRef<MyClient>({
  id: "plugin.my-plugin.client",
});

export const myPluginApi = createApiFactory({
  api: myPluginApiRef,
  deps: { discoveryApi: discoveryApiRef },
  factory: ({ discoveryApi }) => new MyClient({ discoveryApi }),
});
