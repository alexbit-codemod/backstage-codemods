#!/usr/bin/env node
/**
 * Updates package.json for full NFS migration: removes legacy frontend API deps,
 * ensures @backstage/frontend-plugin-api is present when the package had core-plugin-api.
 */
import fs from "fs";
import path from "path";

const targetRoot =
  process.env.CODEMOD_TARGET ||
  process.env.CODEMOD_TARGET_PATH ||
  process.argv[2] ||
  process.cwd();
const pkgPath = path.join(targetRoot, "package.json");

if (!fs.existsSync(pkgPath)) {
  process.exit(0);
}

const raw = fs.readFileSync(pkgPath, "utf8");
const pkg = JSON.parse(raw);

const hadCore =
  raw.includes("@backstage/core-plugin-api") ||
  raw.includes("@backstage/core-compat-api");

const remove = new Set([
  "@backstage/core-plugin-api",
  "@backstage/core-compat-api",
]);

let changed = false;
for (const dep of ["dependencies", "devDependencies", "peerDependencies"]) {
  const block = pkg[dep];
  if (!block || typeof block !== "object") {
    continue;
  }
  for (const name of remove) {
    if (Object.prototype.hasOwnProperty.call(block, name)) {
      delete block[name];
      changed = true;
    }
  }
}

const deps = pkg.dependencies;
if (deps && typeof deps === "object" && hadCore) {
  if (!Object.prototype.hasOwnProperty.call(deps, "@backstage/frontend-plugin-api")) {
    deps["@backstage/frontend-plugin-api"] = "^1.0.0";
    changed = true;
  }
}

if (changed) {
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}
