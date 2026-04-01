# backstage-plugin-frontend-system-migration

Multi-step Codemod workflow for a **full** [Backstage new frontend system](https://backstage.io/docs/frontend-system/building-plugins/migrating) migration (drops legacy `@backstage/core-plugin-api` usage).

## Workflows

| File | Purpose |
|------|---------|
| [workflow.yaml](workflow.yaml) | Main pipeline: metrics inventory → route refs → plugin shell → APIs → pages/hooks |
| [workflow.inventory.yaml](workflow.inventory.yaml) | Blast-radius metrics only (`useMetricAtom`) |
| [workflow.manifest.yaml](workflow.manifest.yaml) | `package.json`: remove `core-plugin-api` / `core-compat-api`, add `frontend-plugin-api` |
| [workflow.ai.yaml](workflow.ai.yaml) | Optional manual AI step for SubPageBlueprint / `useRouteRef` guards / ambiguous routes |
| [workflow.shard.yaml](workflow.shard.yaml) | Optional PR-sized shards for large monorepos |

## Usage

```bash
# From registry (when published)
npx codemod run backstage-plugin-frontend-system-migration --target /path/to/plugin

# Local
npx codemod workflow run -w workflow.yaml -t /path/to/backstage-repo
npx codemod workflow run -w workflow.manifest.yaml -t /path/to/plugin-package
```

Set `CODEMOD_TARGET` or `CODEMOD_TARGET_PATH` when running `scripts/package-manifest.mjs` so the target package root is explicit if the shell cwd is not the plugin.

## Scripts

- `scripts/inventory.ts` — metrics (patterns and risk: safe / medium / tricky)
- `scripts/route-refs.ts` — `createRouteRef` / `createSubRouteRef` / `createExternalRouteRef` (uses `@jssg/utils` for imports)
- `scripts/plugin-shell.ts` — `createPlugin` → `createFrontendPlugin`, `id` → `pluginId`, optional `plugin.ts` → `plugin.tsx`
- `scripts/apis.ts` — `createApiFactory` → `ApiBlueprint.make`, `createApiRef` → `.with({ pluginId })`
- `scripts/pages-hooks.ts` — migratable pure imports from core → frontend; `backstage-nfs-router-ambiguity` metric for `<Routes>`
- `scripts/package-manifest.mjs` — manifest cleanup

## Development

```bash
npm test
npx codemod workflow validate -w workflow.yaml
```

## License

MIT
