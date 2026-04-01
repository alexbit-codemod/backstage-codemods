import type { Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";
import apisTransform from "./apis.ts";
import inventoryTransform from "./inventory.ts";
import { CODEMOD_FILENAME_PARAM } from "./lib/effective-filename.ts";
import { parseSource } from "./lib/reparse-root.ts";
import pagesHooksTransform from "./pages-hooks.ts";
import pluginShellTransform from "./plugin-shell.ts";
import routeRefsTransform from "./route-refs.ts";

type TransformOpts = Parameters<Transform<TSX>>[1];

/**
 * Single JSSG entrypoint: runs blast-radius metrics, route refs, plugin shell,
 * APIs, and pages/hooks in a fixed order.
 *
 * Each phase returns the string from `commitEdits` or `null`. After a phase
 * returns new source, we re-parse so the next phase sees a fresh AST (required
 * for correct results; the runner only applies this transform's final return).
 * Re-parsed roots report `filename() === "anonymous"`; we pass the real path
 * via `params[CODEMOD_FILENAME_PARAM]` so metrics and plugin rename still work.
 */
const transform: Transform<TSX> = async (root, options) => {
  const filePath = root.filename();
  const opts = {
    ...options,
    params: {
      ...(options?.params ?? {}),
      [CODEMOD_FILENAME_PARAM]: filePath,
    },
  } as TransformOpts;

  await inventoryTransform(root, opts);

  let current: typeof root = root;
  let lastOut: string | null = null;

  const runPhase = async (fn: Transform<TSX>): Promise<void> => {
    const out = await fn(current, opts);
    if (out !== null) {
      lastOut = out;
      current = parseSource(out);
    }
  };

  await runPhase(routeRefsTransform);
  await runPhase(pluginShellTransform);
  await runPhase(apisTransform);
  await runPhase(pagesHooksTransform);

  return lastOut;
};

export default transform;
