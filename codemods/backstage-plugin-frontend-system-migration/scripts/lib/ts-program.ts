import type { SgRoot } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";

/** Root program node from `root.root()` */
export type TsProgramRoot = ReturnType<SgRoot<TSX>["root"]>;
