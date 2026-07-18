#!/usr/bin/env node
// Rewrites every workspace package's version to "<specVersion>.1" when the
// MDI spec version changes (e.g. "2.0" -> "2.1"). Patch always resets to 1,
// never 0 — the first release under a spec generation is always ".1".
//
// Ordinary releases within the same spec version use `pnpm changeset`
// (patch-only bumps: 2.1.1 -> 2.1.2 -> ...); this script is only for the
// spec-version jump itself, which Changesets has no concept of.
//
// Usage: node scripts/bump-spec-version.mjs 2.1

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const specVersion = process.argv[2];
if (!specVersion || !/^\d+\.\d+$/.test(specVersion)) {
  console.error("Usage: node scripts/bump-spec-version.mjs <major.minor>  (e.g. 2.1)");
  process.exit(1);
}

const newVersion = `${specVersion}.1`;
const root = path.resolve(fileURLToPath(import.meta.url), "../..");
const packagesDir = path.join(root, "packages");

for (const dir of readdirSync(packagesDir)) {
  const file = path.join(packagesDir, dir, "package.json");
  if (!existsSync(file)) continue;
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  const previous = pkg.version;
  pkg.version = newVersion;
  writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`${pkg.name}: ${previous} -> ${newVersion}`);
}

const rootPkgPath = path.join(root, "package.json");
const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf8"));
rootPkg.version = newVersion;
writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + "\n");
