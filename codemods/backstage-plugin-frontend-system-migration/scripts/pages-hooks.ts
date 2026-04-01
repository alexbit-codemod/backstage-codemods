import type { Edit, SgNode, Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";
import { useMetricAtom } from "codemod:metrics";
import { CORE_PLUGIN_API, FRONTEND_PLUGIN_API } from "./lib/constants.ts";
import type { TsProgramRoot } from "./lib/ts-program.ts";

/** Symbols that map 1:1 from core-plugin-api to frontend-plugin-api (import path only). */
const MIGRABLE_CORE_IMPORTS = new Set([
  "useApi",
  "useRouteRef",
  "configApiRef",
  "discoveryApiRef",
  "fetchApiRef",
  "identityApiRef",
  "storageApiRef",
  "analyticsApiRef",
]);

const routerAmbiguity = useMetricAtom("backstage-nfs-router-ambiguity");

function getImportedNames(stmt: SgNode<TSX>): string[] {
  const specifiers = stmt.findAll({ rule: { kind: "import_specifier" } });
  const names: string[] = [];
  for (const spec of specifiers) {
    const name = spec.field("name");
    if (name) {
      names.push(name.text());
    }
  }
  return names;
}

function migratePureCoreImports(rootNode: TsProgramRoot): Edit[] {
  const edits: Edit[] = [];
  const stmts = rootNode.findAll({ rule: { kind: "import_statement" } });
  for (const stmt of stmts) {
    const t = stmt.text();
    if (!t.includes(`"${CORE_PLUGIN_API}"`) && !t.includes(`'${CORE_PLUGIN_API}'`)) {
      continue;
    }
    const imported = getImportedNames(stmt);
    if (imported.length === 0) {
      continue;
    }
    const allMigratable = imported.every((n) => MIGRABLE_CORE_IMPORTS.has(n));
    if (!allMigratable) {
      continue;
    }
    const newT = t
      .replace(`"${CORE_PLUGIN_API}"`, `"${FRONTEND_PLUGIN_API}"`)
      .replace(`'${CORE_PLUGIN_API}'`, `'${FRONTEND_PLUGIN_API}'`);
    if (newT !== t) {
      edits.push(stmt.replace(newT));
    }
  }
  return edits;
}

function flagInternalRouters(rootNode: TsProgramRoot, file: string): void {
  const hasRoutes = rootNode.find({
    rule: {
      kind: "call_expression",
      has: {
        field: "function",
        kind: "member_expression",
        has: { kind: "property_identifier", regex: "^Routes$" },
      },
    },
  });
  if (hasRoutes) {
    routerAmbiguity.increment({ pattern: "Routes-internal-router", file });
  }
}

const transform: Transform<TSX> = async (root) => {
  const rootNode = root.root();
  const file = root.filename();
  const edits: Edit[] = [];

  edits.push(...migratePureCoreImports(rootNode));
  flagInternalRouters(rootNode, file);

  if (edits.length === 0) {
    return null;
  }
  return rootNode.commitEdits(edits);
};

export default transform;
