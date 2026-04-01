import {
  ApiBlueprint,
  createApiRef,
  discoveryApiRef,
} from "@backstage/frontend-plugin-api";

export const myPluginApiRef = createApiRef<MyClient>().with({ id: "plugin.my-plugin.client", pluginId: "my-plugin" });

export const myPluginApi = ApiBlueprint.make({ params: defineParams => defineParams({
  api: myPluginApiRef,
  deps: { discoveryApi: discoveryApiRef },
  factory: ({ discoveryApi }) => new MyClient({ discoveryApi }),
}) });
