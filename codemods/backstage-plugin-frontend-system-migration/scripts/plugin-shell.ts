import type { Edit, SgNode, Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";
import { addImport, getImport, removeImport } from "@jssg/utils/javascript/imports";
import { CORE_PLUGIN_API, FRONTEND_PLUGIN_API } from "./lib/constants.ts";
import type { TsProgramRoot } from "./lib/ts-program.ts";

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

function ensureCreateFrontendPluginImport(rootNode: TsProgramRoot): Edit[] {
  const edits: Edit[] = [];
  const imp = getImport(rootNode, {
    type: "named",
    name: "createPlugin",
    from: CORE_PLUGIN_API,
  });
  if (!imp) {
    return edits;
  }
  const stmt = rootNode.findAll({ rule: { kind: "import_statement" } }).find((s: SgNode<TSX>) =>
    s.text().includes(CORE_PLUGIN_API),
  );
  if (!stmt) {
    return edits;
  }
  const imported = getImportedNames(stmt);
  if (imported.length === 1 && imported[0] === "createPlugin") {
    const t = stmt.text();
    const newT = t
      .replace(`"${CORE_PLUGIN_API}"`, `"${FRONTEND_PLUGIN_API}"`)
      .replace(`'${CORE_PLUGIN_API}'`, `'${FRONTEND_PLUGIN_API}'`)
      .replace(/\bcreatePlugin\b/, "createFrontendPlugin");
    if (newT !== t) {
      edits.push(stmt.replace(newT));
    }
    return edits;
  }
  const rm = removeImport(rootNode, {
    type: "named",
    specifiers: ["createPlugin"],
    from: CORE_PLUGIN_API,
  });
  if (rm) {
    edits.push(rm);
  }
  const add = addImport(rootNode, {
    type: "named",
    specifiers: [{ name: "createFrontendPlugin" }],
    from: FRONTEND_PLUGIN_API,
  });
  if (add) {
    edits.push(add);
  }
  return edits;
}

function pluginIdPairEdits(obj: SgNode<TSX>): Edit[] {
  const out: Edit[] = [];
  const idPair = obj.findAll({
    rule: {
      kind: "pair",
      has: { kind: "property_identifier", regex: "^id$" },
    },
  })[0];
  if (!idPair) {
    return out;
  }
  const key = idPair.field("key");
  if (key?.is("property_identifier") && key.text() === "id") {
    out.push(key.replace("pluginId"));
  }
  return out;
}

const transform: Transform<TSX> = async (root) => {
  const rootNode = root.root();
  const edits: Edit[] = [];

  edits.push(...ensureCreateFrontendPluginImport(rootNode));

  const calls = rootNode.findAll({
    rule: {
      kind: "call_expression",
      has: {
        field: "function",
        kind: "identifier",
        regex: "^createPlugin$",
      },
    },
  });
  for (const call of calls) {
    const fn = call.field("function");
    if (fn) {
      edits.push(fn.replace("createFrontendPlugin"));
    }
    const argObj = call.find({
      rule: {
        kind: "arguments",
        has: { kind: "object" },
      },
    });
    const obj = argObj?.find({ rule: { kind: "object" } });
    if (obj?.is("object")) {
      edits.push(...pluginIdPairEdits(obj));
    }
  }

  const hasJsx =
    rootNode.find({ rule: { kind: "jsx_element" } }) ||
    rootNode.find({ rule: { kind: "jsx_self_closing_element" } });
  if (root.filename().endsWith("plugin.ts") && hasJsx) {
    root.rename(root.filename().replace(/plugin\.ts$/, "plugin.tsx"));
  }

  if (edits.length === 0) {
    return null;
  }
  return rootNode.commitEdits(edits);
};

export default transform;
