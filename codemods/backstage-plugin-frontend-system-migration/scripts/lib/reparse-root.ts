import { parse } from "codemod:ast-grep";
import type { SgRoot } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";

const TSX_LANG = "tsx";

/** Re-parse source after a prior phase committed edits (native `SgRoot` only — no Proxy). */
export function parseSource(source: string): SgRoot<TSX> {
  return parse(TSX_LANG, source) as SgRoot<TSX>;
}
