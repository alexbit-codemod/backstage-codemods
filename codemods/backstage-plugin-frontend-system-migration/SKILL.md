---
name: backstage-plugin-frontend-system-migration
description: >-
  Guides coding agents through the Backstage “new frontend system” (NFS) migration using
  the backstage-plugin-frontend-system-migration codemod: one workflow node runs a single
  unified JSSG transform (`scripts/unified.ts`) that chains blast-radius metrics → route refs
  → plugin shell → APIs → pure hook imports + router metrics, then optional AI and
  package.json/lockfile steps at
  the end of the same node, gated by workflow params (off by default). Use when migrating from
  @backstage/core-plugin-api, createPlugin/createRouteRef patterns, or when the user asks
  about Backstage frontend-plugin-api, NFS migration, or this package’s workflow.
---

# Backstage plugin → new frontend system (NFS) migration

## What this skill is for

This skill tells agents how to **run and reason about** the **`backstage-plugin-frontend-system-migration`** codemod package: a **workflow-first** migration from legacy `@backstage/core-plugin-api` usage to **`@backstage/frontend-plugin-api`** and the extension-based frontend system.

It does **not** replace reading `workflow.yaml` for exact step names, `js_file` paths, and `include`/`exclude` globs; it gives operational rules: **deterministic scripts first**, then **optional** AI and package updates controlled by **parameters** (defaults **off**).

## When to apply this skill

Use this skill when the task involves any of:

- Migrating a Backstage **frontend plugin** to the [new frontend system](https://backstage.io/docs/frontend-system/building-plugins/migrating).
- Replacing **`@backstage/core-plugin-api`** with **`@backstage/frontend-plugin-api`** (route refs, `createPlugin` → `createFrontendPlugin`, APIs, hooks).
- Running or explaining this repo’s codemod (`workflow.yaml`, `scripts/*.ts`).
- Splitting work into **safe, mechanical changes** vs **context-dependent** changes (routing, external routes, guards).

Do **not** treat this skill as generic Backstage backend or catalog migration—it is **frontend plugin / NFS** focused.

## How to run the codemod

From the **target Backstage repo** (usually monorepo root or plugin package root, depending on how paths are configured):

**Registry / published package:**

```bash
npx codemod run backstage-plugin-frontend-system-migration --target /path/to/repo
```

**Local package (this repository):**

```bash
cd /path/to/backstage-codemods/codemods/backstage-plugin-frontend-system-migration
npx codemod workflow run -w workflow.yaml -t /path/to/backstage-repo
```

**Optional steps (off by default)** — pass workflow parameters:

```bash
npx codemod workflow run -w workflow.yaml -t /path/to/backstage-repo \
  --param run_ai_followups=true \
  --param update_package_dependencies=true
```

**Target directory:** If the shell’s current working directory is not the plugin (or workspace) root the user expects, set:

- `CODEMOD_TARGET` or `CODEMOD_TARGET_PATH` so `run` steps and tooling resolve the correct `package.json`.

**Optional package step:** If the repo uses **pnpm** or **yarn**, set:

- `CODEMOD_PACKAGE_MANAGER=pnpm` or `yarn` (default is `npm`).

When `update_package_dependencies` is true, the workflow removes **`@backstage/core-plugin-api`** and **`@backstage/core-compat-api`**, then adds **`@backstage/frontend-plugin-api@^1.0.0`** (only runs if `package.json` references the legacy core packages).

## Workflow structure (source of truth: `workflow.yaml`)

One **automatic** node (`deterministic-nfs-migration`): a **single task** (sequential steps, one git checkout) so Codemod Cloud does not run parallel checkouts on the same repo (avoids `.git/index.lock` conflicts). The last two steps are optional (AI and package updates), gated by `params` (both default **false**).

| Node ID | Purpose |
|---------|---------|
| `deterministic-nfs-migration` | One **js-ast-grep** step (`scripts/unified.ts` on `**/*.ts` / `**/*.tsx`), then optional AI and/or package steps when enabled. |

### Deterministic phase — step order and behavior

The workflow runs **`scripts/unified.ts`** once per file (`language: tsx`). That module chains the phase scripts below **in this order**. After each phase returns new source from `commitEdits`, unified **re-parses** so the next phase sees an up-to-date AST (required for correctness). Re-parsed trees report `filename() === "anonymous"`; unified injects the real path through transform **`params["codemod.filename"]`**, and **`effectiveFilename`** in `scripts/lib/effective-filename.ts` restores it for metrics and `plugin.ts` → `plugin.tsx` rename logic.

| Order | Phase script | Role |
|------:|--------------|------|
| 1 | `scripts/inventory.ts` | **No file edits.** Increments metric `backstage-nfs-migration` with `step=inventory` for patterns such as `@backstage/core-plugin-api` imports, `createPlugin`, routable extensions, `createApiFactory`, route ref helpers, `useRouteRef`, `bindRoutes`, internal `Route`/`Routes` usage, alpha entry files, etc., each tagged with risk (`safe` / `medium` / `tricky`). |
| 2 | `scripts/route-refs.ts` | Moves `createRouteRef` / `createSubRouteRef` / `createExternalRouteRef` imports toward `@backstage/frontend-plugin-api` (splitting imports from `@backstage/core-plugin-api` when needed). Applies path/default tweaks (e.g. known external route ids → `defaultTarget` via `EXTERNAL_ROUTE_DEFAULT_TARGETS` in `scripts/lib/constants.ts`). Uses `@jssg/utils` for import edits. |
| 3 | `scripts/plugin-shell.ts` | `createPlugin` → `createFrontendPlugin`, import updates, renames the options object key `id` → `pluginId`. If the file is `plugin.ts` and contains JSX, renames the file to `plugin.tsx`. (No-op on files without `createPlugin` / plugin patterns.) |
| 4 | `scripts/apis.ts` | Migrates `createApiFactory` usage toward NFS `ApiBlueprint` patterns and related `createApiRef` handling (when the legacy import shape matches). |
| 5 | `scripts/pages-hooks.ts` | **Edits:** rewrites import statements that import **only** a fixed whitelist of symbols (`useApi`, `useRouteRef`, `configApiRef`, `discoveryApiRef`, `fetchApiRef`, `identityApiRef`, `storageApiRef`, `analyticsApiRef`) from `@backstage/core-plugin-api` to `@backstage/frontend-plugin-api`. **Metrics (no edit):** if a member `.Routes` call is present, increments `backstage-nfs-migration` with `step=pages-hooks`, pattern `Routes-internal-router`, risk `tricky` (signals internal react-router usage that may need `SubPageBlueprint` work). |

**Agent guidance:** After `deterministic-nfs-migration` completes, prefer **running tests and TypeScript checks** in the target repo before editing further by hand. Do not re-implement large refactors manually if the script already covers the pattern—extend the JSSG script or fix edge cases minimally.

### Optional phase — AI and package updates (params, default off)

**Same node** as the JSSG step (**last two steps** after `NFS migration (unified JSSG)` in `deterministic-nfs-migration`).

- **`if: params.run_ai_followups == true`** — AI-assisted edits (model in `workflow.yaml`) for remaining legacy patterns: internal `Routes`/`Route` → `SubPageBlueprint` (top-level tabs), `useRouteRef` undefined guards, `createExternalRouteRef` missing `defaultTarget`. Uses `@backstage/frontend-plugin-api` and `@backstage/ui`.
- **`if: params.update_package_dependencies == true`** — shell step: `cd` to `CODEMOD_TARGET` / `CODEMOD_TARGET_PATH` / `.`, then package-manager remove/add as above.

**Defaults:** `run_ai_followups` and `update_package_dependencies` are **false** in `params.schema`. Enable only when the user explicitly wants AI or dependency churn.

**Agent guidance:** For tricky routing and external refs, mirror the **same priorities** as the AI prompt if the user is editing in the IDE without the CLI: small, reviewable edits using `@backstage/frontend-plugin-api` and `@backstage/ui`.

## Safe vs tricky: decision rule

- **Safe / deterministic:** Single-file or pattern-stable rewrites covered by the JSSG scripts (imports, known call shapes, plugin shell conventions). Run Phase 1 first.
- **Tricky:** Cross-cutting UX/routing, optional chaining for refs, external route wiring — use **`--param run_ai_followups=true`** or hand edits with the same checklist as the AI prompt. Use **inventory** and **pages-hooks** metrics (`Routes-internal-router`, `createExternalRouteRef`, etc.) to prioritize files.

## Development and validation (for agents editing this package)

```bash
npm test
npx codemod workflow validate -w workflow.yaml
```

## Related files

- `workflow.yaml` — node IDs, `params`, step `if` conditions, unified JSSG `include`/`exclude` globs, and AI prompt text.
- `codemod.yaml` — package metadata for the Codemod registry (`name`, `version`, `description`, `workflow` path).
- `scripts/*.ts` — JSSG transforms per phase; `scripts/unified.ts` (orchestration); `scripts/lib/constants.ts`, `scripts/lib/route-ref-ast.ts`, `scripts/lib/reparse-root.ts`, `scripts/lib/effective-filename.ts`.
