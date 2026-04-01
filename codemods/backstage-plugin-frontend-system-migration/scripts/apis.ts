import type { Edit, SgNode, Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";
import { getImport } from "@jssg/utils/javascript/imports";
import { CORE_PLUGIN_API, FRONTEND_PLUGIN_API } from "./lib/constants.ts";
import type { TsProgramRoot } from "./lib/ts-program.ts";

function inferPluginIdFromApiRefId(idLiteral: string): string | null {
  const inner = idLiteral.replace(/^["']|["']$/g, "");
  const m = /^plugin\.([^.]+)\./.exec(inner);
  return m?.[1] ?? null;
}

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

function transformCreateApiFactory(
  rootNode: TsProgramRoot,
): Edit[] {
  const edits: Edit[] = [];
  if (
    !getImport(rootNode, {
      type: "named",
      name: "createApiFactory",
      from: CORE_PLUGIN_API,
    })
  ) {
    return edits;
  }

  const calls = rootNode.findAll({
    rule: {
      kind: "call_expression",
      has: {
        field: "function",
        kind: "identifier",
        regex: "^createApiFactory$",
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
    const innerText = obj.text();
    edits.push(
      call.replace(
        `ApiBlueprint.make({ params: defineParams => defineParams(${innerText}) })`,
      ),
    );
  }
  return edits;
}

function transformCreateApiRef(rootNode: TsProgramRoot): Edit[] {
  const edits: Edit[] = [];
  if (
    !getImport(rootNode, {
      type: "named",
      name: "createApiRef",
      from: CORE_PLUGIN_API,
    })
  ) {
    return edits;
  }

  const withGeneric = rootNode.findAll({
    rule: {
      pattern: "createApiRef<$T>({ id: $ID })",
    },
  });
  for (const call of withGeneric) {
    const idNode = call.getMatch("ID");
    const idText = idNode?.text() ?? "";
    const pluginId = inferPluginIdFromApiRefId(idText);
    if (!pluginId) {
      continue;
    }
    const typeArgs = call.getMatch("T")?.text() ?? "";
    const generic = typeArgs ? `<${typeArgs}>` : "";
    edits.push(
      call.replace(
        `createApiRef${generic}().with({ id: ${idText}, pluginId: "${pluginId}" })`,
      ),
    );
  }

  const noGeneric = rootNode.findAll({
    rule: {
      pattern: "createApiRef({ id: $ID })",
    },
  });
  for (const call of noGeneric) {
    if (withGeneric.some((w: SgNode<TSX>) => w.id() === call.id())) {
      continue;
    }
    const idNode = call.getMatch("ID");
    const idText = idNode?.text() ?? "";
    const pluginId = inferPluginIdFromApiRefId(idText);
    if (!pluginId) {
      continue;
    }
    edits.push(
      call.replace(
        `createApiRef().with({ id: ${idText}, pluginId: "${pluginId}" })`,
      ),
    );
  }

  return edits;
}

function rewriteCoreApiImport(rootNode: TsProgramRoot): Edit | null {
  const stmt = rootNode.findAll({ rule: { kind: "import_statement" } }).find((s: SgNode<TSX>) =>
    s.text().includes(CORE_PLUGIN_API),
  );
  if (!stmt) {
    return null;
  }
  const names = getImportedNames(stmt);
  const next = new Set(names);
  next.delete("createApiFactory");
  if (next.has("createApiRef")) {
    /* keep */
  }
  if (names.includes("createApiFactory") || names.includes("createApiRef")) {
    next.add("ApiBlueprint");
  }
  const list = [...next].sort();
  if (list.length === 0) {
    return null;
  }
  const spec = list.map((n) => `  ${n}`).join(",\n");
  const newStmt = `import {\n${spec},\n} from "${FRONTEND_PLUGIN_API}";`;
  return stmt.replace(newStmt);
}

const transform: Transform<TSX> = async (root) => {
  const rootNode = root.root();
  const edits: Edit[] = [];

  edits.push(...transformCreateApiRef(rootNode));
  edits.push(...transformCreateApiFactory(rootNode));

  const importEdit = rewriteCoreApiImport(rootNode);
  if (importEdit) {
    edits.push(importEdit);
  }

  if (edits.length === 0) {
    return null;
  }
  return rootNode.commitEdits(edits);
};

export default transform;
