---
name: backstage-plugin-frontend-system-migration
description: >-
  Guides coding agents through the Backstage “new frontend system” (NFS) migration using
  the backstage-plugin-frontend-system-migration codemod: run deterministic JSSG workflow
  steps for safe refactors (imports, route refs, plugin shell, APIs, hooks); enable optional
  AI follow-ups and package.json/lockfile updates via workflow params (off by default).
  Use when migrating from @backstage/core-plugin-api, createPlugin/createRouteRef patterns,
  or when the user asks about Backstage frontend-plugin-api, NFS migration, or this package’s
  workflow.
---

# Backstage plugin → new frontend system (NFS) migration

## What this skill is for

This skill tells agents how to **run and reason about** the **`backstage-plugin-frontend-system-migration`** codemod package: a **workflow-first** migration from legacy `@backstage/core-plugin-api` usage to **`@backstage/frontend-plugin-api`** and the extension-based frontend system.

It does **not** replace reading `workflow.yaml` for exact step IDs; it gives operational rules: **deterministic scripts first**, then **optional** AI and package updates controlled by **parameters** (defaults **off**).

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

**Local package (this repository’s folder):**

```bash
cd /path/to/backstage-plugin-frontend-system-migration
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

## Workflow steps (order matters)

The workflow is defined in **`workflow.yaml`**. All nodes are **automatic**.

### Phase 1 — Deterministic — prefer these for “safe” changes

The workflow runs **`deterministic-nfs-migration`** as a **single automatic node** with **five sequential steps** (same JSSG scripts as before). This keeps **one Codemod Cloud task** for the whole phase so the runner does not `git checkout` in parallel on the same repo (which caused `.git/index.lock` errors when each step was a separate node).

| Step (order) | Script | Role |
|--------------|--------|------|
| 1 | `inventory.ts` | **Metrics only** (no file edits). Emits `backstage-nfs-migration` with `step=inventory`. |
| 2 | `route-refs.ts` | Route refs and related import moves toward `@backstage/frontend-plugin-api`. |
| 3 | `plugin-shell.ts` | `createPlugin` → `createFrontendPlugin`, plugin id field, `plugin.ts` → `plugin.tsx` when needed. |
| 4 | `apis.ts` | `createApiFactory` / `createApiRef` style updates toward NFS APIs. |
| 5 | `pages-hooks.ts` | Pure import rewrites for selected hooks/API refs; router signals (`step=pages-hooks`). |

**Agent guidance:** After this node completes, prefer **running tests and TypeScript checks** in the target repo before editing further by hand. Do not re-implement large refactors manually if the script already covers the pattern—extend the JSSG script or fix edge cases minimally.

### Phase 2 — Optional — AI and package updates (params, default off)

**Node:** `optional-nfs-followups` (**automatic**). It runs **after** `deterministic-nfs-migration` in a **single task** (sequential git). Steps use:

- **`if: params.run_ai_followups == true`** — AI-assisted edits for tricky cases (SubPageBlueprint, `useRouteRef` guards, `defaultTarget`, etc.).
- **`if: params.update_package_dependencies == true`** — remove legacy core deps and add `@backstage/frontend-plugin-api`.

**Defaults:** `run_ai_followups` and `update_package_dependencies` are **false** in `params.schema`. Enable only when the user explicitly wants AI or dependency churn.

**Agent guidance:** For tricky routing and external refs, mirror the **same priorities** as the AI prompt if the user is editing in the IDE without the CLI: small, reviewable edits using `@backstage/frontend-plugin-api` and `@backstage/ui`.

## Safe vs tricky: decision rule

- **Safe / deterministic:** Single-file or pattern-stable rewrites covered by the JSSG scripts (imports, known call shapes, plugin shell conventions). Use Phase 1 first.
- **Tricky:** Cross-cutting UX/routing, optional chaining for refs, external route wiring — use **`--param run_ai_followups=true`** or hand edits with the same checklist as the AI prompt.

## Development and validation (for agents editing this package)

```bash
npm test
npx codemod workflow validate -w workflow.yaml
```

## Related files

- `workflow.yaml` — source of truth for node IDs, `params`, and step `if` conditions.
- `codemod.yaml` — package metadata for the Codemod registry.
- `scripts/*.ts` — JSSG transforms per phase.
