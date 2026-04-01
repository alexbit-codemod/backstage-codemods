import type { Edit, SgNode, Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";
import { addImport, getImport, removeImport } from "@jssg/utils/javascript/imports";
import {
  CORE_PLUGIN_API,
  EXTERNAL_ROUTE_DEFAULT_TARGETS,
  FRONTEND_PLUGIN_API,
} from "./lib/constants.ts";
import { normalizeSubRoutePath, removeObjectPropertyNamed } from "./lib/route-ref-ast.ts";
import type { TsProgramRoot } from "./lib/ts-program.ts";

const ROUTE_REF_NAMES = [
  "createRouteRef",
  "createSubRouteRef",
  "createExternalRouteRef",
] as const;

/** Imported binding names (right-hand side of `import { x as y }`) */
function getImportedNamesFromStatement(
  stmt: import("codemod:ast-grep").SgNode<TSX>,
): string[] {
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

function ensureFrontendRouteImports(rootNode: TsProgramRoot): Edit[] {
  const edits: Edit[] = [];
  const stmts = rootNode.findAll({ rule: { kind: "import_statement" } });
  for (const stmt of stmts) {
    const t = stmt.text();
    if (!t.includes(`"${CORE_PLUGIN_API}"`) && !t.includes(`'${CORE_PLUGIN_API}'`)) {
      continue;
    }
    const imported = getImportedNamesFromStatement(stmt);
    const routeImported = imported.filter((n: string) =>
      (ROUTE_REF_NAMES as readonly string[]).includes(n),
    );
    if (routeImported.length === 0) {
      continue;
    }
    if (imported.length === routeImported.length) {
      const newT = t
        .replace(`"${CORE_PLUGIN_API}"`, `"${FRONTEND_PLUGIN_API}"`)
        .replace(`'${CORE_PLUGIN_API}'`, `'${FRONTEND_PLUGIN_API}'`);
      if (newT !== t) {
        edits.push(stmt.replace(newT));
      }
      continue;
    }
    const namesFromCore = routeImported;
    const add = addImport(rootNode, {
      type: "named",
      specifiers: namesFromCore.map((name) => ({ name })),
      from: FRONTEND_PLUGIN_API,
    });
    if (add) {
      edits.push(add);
    }
    const rm = removeImport(rootNode, {
      type: "named",
      specifiers: namesFromCore,
      from: CORE_PLUGIN_API,
    });
    if (rm) {
      edits.push(rm);
    }
  }
  return edits;
}

function getStringFragment(strNode: import("codemod:ast-grep").SgNode<TSX>): string | null {
  if (!strNode.is("string")) {
    return null;
  }
  const frag = strNode.find({ rule: { kind: "string_fragment" } });
  return frag?.text() ?? null;
}

function transformCreateRouteRefCalls(rootNode: TsProgramRoot): Edit[] {
  const edits: Edit[] = [];
  const hasRef =
    getImport(rootNode, {
      type: "named",
      name: "createRouteRef",
      from: CORE_PLUGIN_API,
    }) ||
    getImport(rootNode, {
      type: "named",
      name: "createRouteRef",
      from: FRONTEND_PLUGIN_API,
    });
  if (!hasRef) {
    return edits;
  }

  const singleId = rootNode.findAll({
    rule: { pattern: "createRouteRef({ id: $ID })" },
  });
  for (const call of singleId) {
    edits.push(call.replace("createRouteRef()"));
  }

  const calls = rootNode.findAll({
    rule: {
      kind: "call_expression",
      has: {
        field: "function",
        kind: "identifier",
        regex: "^createRouteRef$",
      },
    },
  });
  for (const call of calls) {
    if (singleId.some((s: SgNode<TSX>) => s.id() === call.id())) {
      continue;
    }
    const argObj = call.find({
      rule: {
        kind: "arguments",
        has: { kind: "object" },
      },
    });
    const obj = argObj?.find({ rule: { kind: "object" } });
    if (!obj?.is("object")) {
      continue;
    }
    const pairNodes = obj.findAll({ rule: { kind: "pair" } });
    const hasId = pairNodes.some((p: SgNode<TSX>) =>
      p.has({
        rule: {
          kind: "property_identifier",
          regex: "^id$",
        },
      }),
    );
    if (!hasId) {
      continue;
    }
    if (pairNodes.length === 1) {
      edits.push(call.replace("createRouteRef()"));
    } else {
      const idEdit = removeObjectPropertyNamed(obj, "id");
      if (idEdit) {
        edits.push(idEdit);
      }
    }
  }
  return edits;
}

function transformCreateSubRouteRefCalls(rootNode: TsProgramRoot): Edit[] {
  const edits: Edit[] = [];
  const hasRef =
    getImport(rootNode, {
      type: "named",
      name: "createSubRouteRef",
      from: CORE_PLUGIN_API,
    }) ||
    getImport(rootNode, {
      type: "named",
      name: "createSubRouteRef",
      from: FRONTEND_PLUGIN_API,
    });
  if (!hasRef) {
    return edits;
  }

  const ordered = rootNode.findAll({
    rule: {
      pattern: "createSubRouteRef({ id: $I, parent: $P, path: $PATH })",
    },
  });
  for (const call of ordered) {
    const pathExpr = call.getMatch("PATH");
    if (!pathExpr?.is("string")) {
      continue;
    }
    const norm = normalizeSubRoutePath(pathExpr.text());
    const parentText = call.getMatch("P")?.text() ?? "";
    edits.push(
      call.replace(
        `createSubRouteRef({ parent: ${parentText}, path: ${norm} })`,
      ),
    );
  }

  const calls = rootNode.findAll({
    rule: {
      kind: "call_expression",
      has: {
        field: "function",
        kind: "identifier",
        regex: "^createSubRouteRef$",
      },
    },
  });
  for (const call of calls) {
    if (ordered.some((o: SgNode<TSX>) => o.id() === call.id())) {
      continue;
    }
    const argObj = call.find({
      rule: {
        kind: "arguments",
        has: { kind: "object" },
      },
    });
    const obj = argObj?.find({ rule: { kind: "object" } });
    if (!obj?.is("object")) {
      continue;
    }
    const idEdit = removeObjectPropertyNamed(obj, "id");
    if (idEdit) {
      edits.push(idEdit);
    }
    const pathPair = obj.findAll({
      rule: {
        kind: "pair",
        has: { kind: "property_identifier", regex: "^path$" },
      },
    })[0];
    if (pathPair) {
      const val = pathPair.field("value");
      if (val?.is("string")) {
        const raw = val.text();
        const norm = normalizeSubRoutePath(raw);
        if (norm !== raw) {
          edits.push({
            startPos: val.range().start.index,
            endPos: val.range().end.index,
            insertedText: norm,
          });
        }
      }
    }
  }
  return edits;
}

function pairPropertyName(pair: SgNode<TSX>): string | null {
  const key = pair.field("key");
  if (!key) {
    return null;
  }
  if (key.is("property_identifier")) {
    return key.text();
  }
  return null;
}

function transformCreateExternalRouteRefCalls(
  rootNode: TsProgramRoot,
): Edit[] {
  const edits: Edit[] = [];
  const hasRef =
    getImport(rootNode, {
      type: "named",
      name: "createExternalRouteRef",
      from: CORE_PLUGIN_API,
    }) ||
    getImport(rootNode, {
      type: "named",
      name: "createExternalRouteRef",
      from: FRONTEND_PLUGIN_API,
    });
  if (!hasRef) {
    return edits;
  }

  const calls = rootNode.findAll({
    rule: {
      kind: "call_expression",
      has: {
        field: "function",
        kind: "identifier",
        regex: "^createExternalRouteRef$",
      },
    },
  });
  for (const call of calls) {
    const obj = call.find({
      rule: {
        kind: "arguments",
        has: { kind: "object" },
      },
    })?.find({ rule: { kind: "object" } });
    if (!obj?.is("object")) {
      continue;
    }
    const pairs = obj.findAll({ rule: { kind: "pair" } });
    const idPair = pairs.find((p: SgNode<TSX>) => pairPropertyName(p) === "id");
    let idInner: string | null = null;
    if (idPair) {
      const val = idPair.field("value");
      if (val?.is("string")) {
        idInner = getStringFragment(val);
      }
    }
    const mapped =
      idInner !== null ? EXTERNAL_ROUTE_DEFAULT_TARGETS[idInner] : undefined;

    const names = pairs
      .map((p: SgNode<TSX>) => pairPropertyName(p))
      .filter((n: string | null): n is string => n !== null);
    const sortedKey = [...names].sort().join(",");

    if (mapped) {
      if (names.length === 1 && names[0] === "id") {
        edits.push(
          call.replace(
            `createExternalRouteRef({ defaultTarget: '${mapped}' })`,
          ),
        );
        continue;
      }
      if (
        names.length === 2 &&
        (sortedKey === "id,optional" || sortedKey === "optional,id")
      ) {
        edits.push(
          call.replace(
            `createExternalRouteRef({ defaultTarget: '${mapped}' })`,
          ),
        );
        continue;
      }
    }

    const optRemoved = removeObjectPropertyNamed(obj, "optional");
    if (optRemoved) {
      edits.push(optRemoved);
    }
    const idRemoved = removeObjectPropertyNamed(obj, "id");
    if (idRemoved) {
      edits.push(idRemoved);
    }

    if (mapped) {
      const hasDefault = obj.find({
        rule: {
          kind: "pair",
          has: { kind: "property_identifier", regex: "^defaultTarget$" },
        },
      });
      if (!hasDefault) {
        edits.push({
          startPos: obj.range().start.index + 1,
          endPos: obj.range().start.index + 1,
          insertedText: `defaultTarget: '${mapped}', `,
        });
      }
    }
  }
  return edits;
}

const transform: Transform<TSX> = async (root) => {
  const rootNode = root.root();
  const edits: Edit[] = [];

  edits.push(...ensureFrontendRouteImports(rootNode));
  edits.push(...transformCreateRouteRefCalls(rootNode));
  edits.push(...transformCreateSubRouteRefCalls(rootNode));
  edits.push(...transformCreateExternalRouteRefCalls(rootNode));

  if (edits.length === 0) {
    return null;
  }
  return rootNode.commitEdits(edits);
};

export default transform;
