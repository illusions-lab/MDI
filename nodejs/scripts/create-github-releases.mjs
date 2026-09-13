#!/usr/bin/env node
// Create package releases from the verified immutable npm artifact manifest.
// Recovery verifies existing assets and never overwrites published bytes.

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { integrity, verifyReleaseArtifacts } from "./release-artifacts.mjs";
import { fileURLToPath } from "node:url";

const packagesRoot = path.resolve(fileURLToPath(import.meta.url), "../..");
const repositoryRoot = path.resolve(packagesRoot, "..");
const packagesDir = path.join(packagesRoot, "packages");
if (process.env.GITHUB_ACTIONS !== "true") throw new Error("Production release creation must run in GitHub Actions");
const artifactsDirectory = path.resolve(repositoryRoot, process.env.RELEASE_ARTIFACTS_DIR ?? "output/npm-release");
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], {cwd:repositoryRoot,encoding:"utf8"}).trim();
const manifest = verifyReleaseArtifacts(JSON.parse(readFileSync(path.join(artifactsDirectory,"manifest.json"),"utf8")),artifactsDirectory,sourceSha);

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

for (const entry of published) {
	const name = typeof entry === "string" ? entry : entry.name;
	const dir = dirByName.get(name);
	if (!dir) {
		throw new Error(`Could not find a workspace package directory for ${name}.`);
	}
	const packageJson = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
	const version = typeof entry === "string" ? packageJson.version : entry.version;
	if (!name || !version) {
		throw new Error("Each published package must include a name and version.");
	}

	const artifact = manifest.artifacts.find((artifact) => artifact.name === name && artifact.version === version);
	if (!artifact) throw new Error(`No verified artifact for ${name}@${version}`);
	const tarballPath = path.join(artifactsDirectory, artifact.filename);

	const notes = changelogEntry(dir, version) ?? `${name} ${version}`;
	const tag = `${name}@${version}`;

	const exists = (() => {
		try {
			execFileSync("gh", ["release", "view", tag], { cwd: repositoryRoot, stdio: "ignore" });
			return true;
		} catch {
			return false;
		}
	})();

	const temporary = mkdtempSync(path.join(tmpdir(), "mdi-release-notes-"));
	try {
		if (!exists) {
			const notesPath = path.join(temporary, "notes.md");
			writeFileSync(notesPath, notes);
			execFileSync("gh", ["release", "create", tag, "--target", sourceSha, "--title", tag, "--notes-file", notesPath], { cwd: repositoryRoot, stdio: "inherit" });
		}
		const release = JSON.parse(execFileSync("gh", ["release", "view", tag, "--json", "assets"], { cwd: repositoryRoot, encoding: "utf8" }));
		if (release.assets.some((asset) => asset.name === artifact.filename)) {
			execFileSync("gh", ["release", "download", tag, "--pattern", artifact.filename, "--dir", temporary], {cwd:repositoryRoot,stdio:"inherit"});
			if (integrity(readFileSync(path.join(temporary,artifact.filename))) !== artifact.integrity) throw new Error(`Existing GitHub asset differs for ${tag}; publish a new patch`);
		} else {
			execFileSync("gh", ["release", "upload", tag, tarballPath], { cwd: repositoryRoot, stdio: "inherit" });
		}
	} finally {
		rmSync(temporary, {recursive:true,force:true});
	}
}

/** Extracts the "## <version>" section from a package's CHANGELOG.md, if present. */
function changelogEntry(dir, version) {
	const changelogPath = path.join(dir, "CHANGELOG.md");
	if (!existsSync(changelogPath)) return undefined;

	const lines = readFileSync(changelogPath, "utf8").split("\n");
	const startIndex = lines.findIndex((line) => (line.trim() === `## ${version}` || line.startsWith(`## ${version} `)));
	if (startIndex === -1) return undefined;

	const endIndex = lines.findIndex((line, index) => index > startIndex && /^## /.test(line));
	return lines
		.slice(startIndex + 1, endIndex === -1 ? undefined : endIndex)
		.join("\n")
		.trim();
}
