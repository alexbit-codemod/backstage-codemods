# backstage-plugin-frontend-system-migration

Multi-step Codemod workflow for a **full** [Backstage new frontend system](https://backstage.io/docs/frontend-system/building-plugins/migrating) migration (drops legacy `@backstage/core-plugin-api` usage).

## Workflow

Everything lives in **[workflow.yaml](workflow.yaml)**. All nodes are **automatic**.

| Node | Depends on | Purpose |
|------|------------|---------|
| `deterministic-nfs-migration` | — | **One task**, sequential JSSG steps: inventory metrics → route refs → plugin shell → APIs → pages/hooks (single task avoids parallel git on Codemod Cloud). |
| `optional-nfs-followups` | `deterministic-nfs-migration` | Optional **AI** and/or **package.json + lockfile** steps, gated by [parameters](#parameters) (both **off by default**). |

The deterministic phase runs as **steps inside** `deterministic-nfs-migration` (same order: `inventory.ts` → `route-refs.ts` → `plugin-shell.ts` → `apis.ts` → `pages-hooks.ts`).

## Parameters

Defaults are **false** for both:

| Parameter | When `true` |
|-----------|-------------|
| `run_ai_followups` | Runs the AI step (SubPageBlueprint, `useRouteRef` guards, external route defaults). |
| `update_package_dependencies` | Removes legacy `@backstage/core-*` deps and adds `@backstage/frontend-plugin-api` (uses npm by default; see env below). |

## Usage

```bash
# Default: deterministic migration only (no AI, no package.json changes)
npx codemod run backstage-plugin-frontend-system-migration --target /path/to/repo

# Local
npx codemod workflow run -w workflow.yaml -t /path/to/backstage-repo

# Enable optional steps (repeat --param for each)
npx codemod workflow run -w workflow.yaml -t /path/to/repo \
  --param run_ai_followups=true \
  --param update_package_dependencies=true
```

**Target directory:** set `CODEMOD_TARGET` or `CODEMOD_TARGET_PATH` when the shell working directory is not the plugin package root (used by the optional package step).

**Package manager** for `update_package_dependencies`: set `CODEMOD_PACKAGE_MANAGER` to `pnpm` or `yarn` if the repo does not use npm.

## Scripts

- `scripts/inventory.ts` — metrics: `backstage-nfs-migration` with `step=inventory` (patterns and risk: safe / medium / tricky)
- `scripts/route-refs.ts` — route refs (uses `@jssg/utils` for imports)
- `scripts/plugin-shell.ts` — plugin shell + optional `plugin.ts` → `plugin.tsx`
- `scripts/apis.ts` — API factories and refs
- `scripts/pages-hooks.ts` — pure imports + same metric with `step=pages-hooks` for internal `<Routes>` usage

## Agent skill (Cursor / coding agents)

See **[SKILL.md](SKILL.md)** for when to use this migration, how to run the workflow, and how to split deterministic JSSG steps from optional AI follow-ups.

## Development

```bash
npm test
npx codemod workflow validate -w workflow.yaml
```

## License

MIT
