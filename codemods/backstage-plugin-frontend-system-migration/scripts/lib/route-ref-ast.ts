import type { Edit } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";
import type { SgNode } from "codemod:ast-grep";

/** Normalize sub-route path: leading /, no trailing / */
export function normalizeSubRoutePath(pathLiteral: string): string {
  const inner = pathLiteral.replace(/^["']|["']$/g, "");
  if (inner.length === 0) {
    return `"/"`;
  }
  let p = inner.startsWith("/") ? inner : `/${inner}`;
  if (p.length > 1 && p.endsWith("/")) {
    p = p.slice(0, -1);
  }
  const q = pathLiteral.startsWith('"') ? '"' : "'";
  return `${q}${p}${q}`;
}

export function removeObjectPropertyNamed(
  obj: SgNode<TSX>,
  propertyName: string,
): Edit | null {
  const pairs = obj.findAll({
    rule: {
      kind: "pair",
      has: {
        kind: "property_identifier",
        regex: `^${propertyName}$`,
      },
    },
  });
  const pair = pairs[0];
  if (!pair) {
    return null;
  }
  const children = obj.children();
  const idx = children.findIndex((c) => c.id() === pair.id());
  if (idx < 0) {
    return null;
  }
  let start = pair.range().start.index;
  let end = pair.range().end.index;
  if (idx > 0) {
    const prev = children[idx - 1];
    if (prev?.text() === ",") {
      start = prev.range().start.index;
    }
  } else if (idx + 1 < children.length) {
    const next = children[idx + 1];
    if (next?.text() === ",") {
      end = next.range().end.index;
    }
  }
  return { startPos: start, endPos: end, insertedText: "" };
}
