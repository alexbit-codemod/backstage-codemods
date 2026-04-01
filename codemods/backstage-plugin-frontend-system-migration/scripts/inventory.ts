import type { Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";
import { useMetricAtom } from "codemod:metrics";
import { CORE_PLUGIN_API, NFS_MIGRATION_METRIC } from "./lib/constants.ts";
import { effectiveFilename } from "./lib/effective-filename.ts";

const nfsMigration = useMetricAtom(NFS_MIGRATION_METRIC);

function record(
  pattern: string,
  risk: "safe" | "medium" | "tricky",
  file: string,
): void {
  nfsMigration.increment({ step: "inventory", pattern, risk, file });
}

const transform: Transform<TSX> = async (root, options) => {
  const rootNode = root.root();
  const file = effectiveFilename(root, options);

  const importStmts = rootNode.findAll({
    rule: { kind: "import_statement" },
  });
  const hasCorePluginApi = importStmts.some((s) =>
    s.text().includes(`"${CORE_PLUGIN_API}"`) ||
    s.text().includes(`'${CORE_PLUGIN_API}'`),
  );
  if (hasCorePluginApi) {
    record("import-core-plugin-api", "safe", file);
  }

  if (
    rootNode.find({
      rule: {
        kind: "call_expression",
        has: {
          field: "function",
          kind: "identifier",
          regex: "^createPlugin$",
        },
      },
    })
  ) {
    record("createPlugin", "medium", file);
  }

  if (
    rootNode.find({
      rule: {
        kind: "call_expression",
        has: {
          field: "function",
          kind: "identifier",
          regex: "^createRoutableExtension$",
        },
      },
    })
  ) {
    record("createRoutableExtension", "medium", file);
  }

  if (
    rootNode.find({
      rule: {
        kind: "call_expression",
        has: {
          field: "function",
          kind: "identifier",
          regex: "^createApiFactory$",
        },
      },
    })
  ) {
    record("createApiFactory", "medium", file);
  }

  if (
    rootNode.find({
      rule: {
        pattern: "createRouteRef($$$ARGS)",
      },
    })
  ) {
    const args = rootNode.findAll({
      rule: { pattern: "createRouteRef($$$ARGS)" },
    });
    for (const call of args) {
      const argsNode = call.getMultipleMatches("ARGS");
      const text = argsNode.map((n) => n.text()).join("");
      if (text.includes("id:")) {
        record("createRouteRef-with-id", "safe", file);
        break;
      }
    }
  }

  if (
    rootNode.find({
      rule: {
        kind: "call_expression",
        has: {
          field: "function",
          kind: "identifier",
          regex: "^createExternalRouteRef$",
        },
      },
    })
  ) {
    record("createExternalRouteRef", "tricky", file);
  }

  if (
    rootNode.find({
      rule: {
        kind: "call_expression",
        has: {
          field: "function",
          kind: "identifier",
          regex: "^useRouteRef$",
        },
      },
    })
  ) {
    record("useRouteRef", "medium", file);
  }

  const pageOrHeader = rootNode.find({
    rule: {
      kind: "import_statement",
      has: {
        kind: "string_fragment",
        regex: "@backstage/core-components",
      },
    },
  });
  if (pageOrHeader) {
    const named = rootNode.findAll({
      rule: {
        kind: "import_specifier",
        has: {
          kind: "identifier",
          regex: "^(Page|Header|PageWithHeader|HeaderTabs)$",
        },
      },
    });
    if (named.length > 0) {
      record("Page-Header-core-components", "tricky", file);
    }
  }

  if (
    rootNode.find({
      rule: {
        kind: "call_expression",
        has: {
          field: "function",
          kind: "identifier",
          regex: "^bindRoutes$",
        },
      },
    })
  ) {
    record("bindRoutes", "safe", file);
  }

  if (
    rootNode.find({
      rule: {
        kind: "call_expression",
        has: {
          field: "function",
          kind: "member_expression",
          has: { kind: "property_identifier", regex: "^Route$" },
        },
      },
    }) ||
    rootNode.find({
      rule: {
        kind: "call_expression",
        has: {
          field: "function",
          kind: "member_expression",
          has: { kind: "property_identifier", regex: "^Routes$" },
        },
      },
    })
  ) {
    record("Routes-internal-router", "tricky", file);
  }

  if (file.includes("alpha.tsx") || file.includes("/alpha.ts")) {
    record("alpha-entry", "medium", file);
  }

  return null;
};

export default transform;
