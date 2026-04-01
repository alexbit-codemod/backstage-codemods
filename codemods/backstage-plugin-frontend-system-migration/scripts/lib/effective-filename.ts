import type { Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";

/** Unified transform sets this when re-parsing from source (`filename()` is `"anonymous"`). */
export const CODEMOD_FILENAME_PARAM = "codemod.filename";

export function effectiveFilename(
  root: { filename: () => string },
  options?: Parameters<Transform<TSX>>[1],
): string {
  const path = root.filename();
  if (path !== "anonymous") {
    return path;
  }
  const override = options?.params?.[CODEMOD_FILENAME_PARAM];
  return typeof override === "string" && override.length > 0 ? override : path;
}
