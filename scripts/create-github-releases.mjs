#!/usr/bin/env node
// Creates one GitHub Release per package changesets/action just published,
// each with a packed npm tarball attached (so a package can be downloaded
// straight from the GitHub Releases page, not just npm) and release notes
// taken from that package's own CHANGELOG.md entry for the version.
//
// Invoked from .github/workflows/release.yml after a successful publish,
// with `publishedPackages` (changesets/action's own output, a JSON array of
// {name, version}) passed in via PUBLISHED_PACKAGES.

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(import.meta.url), "../..");
const packagesDir = path.join(root, "packages");

const raw = process.env.PUBLISHED_PACKAGES;
if (!raw) {
	console.error("PUBLISHED_PACKAGES env var is required");
	process.exit(1);
}

const published = JSON.parse(raw);
if (published.length === 0) {
	console.log("No packages published, nothing to release.");
	process.exit(0);
}

const dirByName = new Map();
for (const dir of readdirSync(packagesDir)) {
	const pkgPath = path.join(packagesDir, dir, "package.json");
	if (!existsSync(pkgPath)) continue;
	const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
	dirByName.set(pkg.name, path.join(packagesDir, dir));
}

for (const { name, version } of published) {
	const dir = dirByName.get(name);
	if (!dir) {
		console.error(`Could not find a workspace package directory for ${name}, skipping its release.`);
		continue;
	}

	console.log(`Packing ${name}@${version}...`);
	const packOutput = execFileSync("npm", ["pack", "--json"], { cwd: dir, encoding: "utf8" });
	const [{ filename }] = JSON.parse(packOutput);
	const tarballPath = path.join(dir, filename);

	const notes = changelogEntry(dir, version) ?? `${name} ${version}`;
	const tag = `${name}@${version}`;

	console.log(`Creating GitHub Release ${tag}...`);
	execFileSync("gh", ["release", "create", tag, tarballPath, "--title", tag, "--notes", notes], {
		cwd: root,
		stdio: "inherit",
	});
}

/** Extracts the "## <version>" section from a package's CHANGELOG.md, if present. */
function changelogEntry(dir, version) {
	const changelogPath = path.join(dir, "CHANGELOG.md");
	if (!existsSync(changelogPath)) return undefined;

	const lines = readFileSync(changelogPath, "utf8").split("\n");
	const startIndex = lines.findIndex((line) => line.trim() === `## ${version}`);
	if (startIndex === -1) return undefined;

	const endIndex = lines.findIndex((line, index) => index > startIndex && /^## /.test(line));
	return lines
		.slice(startIndex + 1, endIndex === -1 ? undefined : endIndex)
		.join("\n")
		.trim();
}
