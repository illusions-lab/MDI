import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { globSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dryRun = process.argv.includes("--dry-run");
const baseArgument = process.argv.indexOf("--base");
const baseRef =
  baseArgument >= 0
    ? process.argv[baseArgument + 1]
    : process.env.RELEASE_BASE_SHA;
const allPackages = globSync(join(root, "packages", "*", "package.json"))
  .map((manifestPath) => ({
    manifestPath,
    manifest: JSON.parse(readFileSync(manifestPath, "utf8")),
  }))
  .filter(({ manifest }) => !manifest.private)
  .sort(({ manifest: a }, { manifest: b }) => a.name.localeCompare(b.name));

if (!baseRef) {
  throw new Error(
    "A release base commit is required. Pass --base <commit> or set RELEASE_BASE_SHA."
  );
}

const changedFiles = execFileSync(
  "git",
  ["diff", "--name-only", `${baseRef}...HEAD`],
  { cwd: root, encoding: "utf8" }
)
  .trim()
  .split("\n")
  .filter(Boolean);
const changedPackages = new Set();
const dependencyRoots = new Set();

for (const file of changedFiles) {
  const nodejsRelative = relative(root, join(root, "..", file));
  const packageMatch = nodejsRelative.match(/^packages\/([^/]+)\//);
  if (packageMatch) {
    const entry = allPackages.find(
      ({ manifestPath }) =>
        relative(root, manifestPath).startsWith(`packages/${packageMatch[1]}/`)
    );
    if (entry) {
      changedPackages.add(entry.manifest.name);
      // A package.json-only change is packaging metadata (for example a
      // repository URL or license) and must not force consumer releases.
      if (nodejsRelative !== `packages/${packageMatch[1]}/package.json`) {
        dependencyRoots.add(entry.manifest.name);
      }
    }
  }
  if (file.startsWith("mdi-core/")) {
    const core = allPackages.find(
      ({ manifest }) => manifest.name === "@illusions-lab/mdi-core"
    );
    if (core) {
      changedPackages.add(core.manifest.name);
      dependencyRoots.add(core.manifest.name);
    }
  }
}

const releaseNames = new Set(changedPackages);
let expanded = true;
while (expanded) {
  expanded = false;
  for (const { manifest } of allPackages) {
    const dependencies = {
      ...manifest.dependencies,
      ...manifest.optionalDependencies,
      ...manifest.peerDependencies,
    };
    if (
      !releaseNames.has(manifest.name) &&
      Object.keys(dependencies).some((name) => dependencyRoots.has(name))
    ) {
      releaseNames.add(manifest.name);
      dependencyRoots.add(manifest.name);
      expanded = true;
    }
  }
}

const packages = allPackages.filter(({ manifest }) => releaseNames.has(manifest.name));
const released = [];

for (const { manifestPath, manifest } of packages) {
  const [major, minor, patch] = manifest.version.split(".");
  if (!/^\d+$/.test(major) || !/^\d+$/.test(minor) || !/^\d+$/.test(patch)) {
    throw new Error(
      `${manifest.name} must use a stable X.Y.Z version as its release baseline.`
    );
  }

  const tagPrefix = `${manifest.name}@${major}.${minor}.`;
  const tags = execFileSync("git", ["tag", "-l", `${tagPrefix}*`], {
    cwd: root,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
  const patches = tags
    .map((tag) => tag.slice(tagPrefix.length))
    .filter((patch) => /^\d+$/.test(patch))
    .map(Number);
  let registryPatch = 0;
  try {
    const published = execFileSync("npm", ["view", manifest.name, "version"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const [publishedMajor, publishedMinor, publishedPatch] = published.split(".");
    if (
      publishedMajor === major &&
      publishedMinor === minor &&
      /^\d+$/.test(publishedPatch)
    ) {
      registryPatch = Number(publishedPatch);
    }
  } catch {
    // A first publication has no npm version yet; tags and the manifest still
    // provide a deterministic next patch.
  }
  const manifestPatch = Number(patch);
  const nextVersion = `${major}.${minor}.${
    Math.max(0, manifestPatch, registryPatch, ...patches) + 1
  }`;

  if (!dryRun) {
    manifest.version = nextVersion;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);
  }
  released.push({ name: manifest.name, version: nextVersion });
}

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `publishedPackages=${JSON.stringify(released)}\n`
  );
}

console.log(
  released.length === 0
    ? "No publishable package changes in this commit range."
    : `${dryRun ? "Would release" : "Prepared release"} ${released
        .map(({ name, version }) => `${name}@${version}`)
        .join(", ")}`
);
