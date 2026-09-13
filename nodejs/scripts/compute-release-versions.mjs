import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { globSync } from "node:fs";
import { join, relative } from "node:path";
import { nextReleaseVersion, releaseClosure } from "./release-version-policy.mjs";

const root = new URL("..", import.meta.url).pathname;
const dryRun = process.argv.includes("--dry-run");
const targetArgument = process.argv.indexOf("--target-version");
const targetVersion = targetArgument >= 0 ? process.argv[targetArgument + 1] : process.env.RELEASE_TARGET_VERSION || undefined;
if (targetArgument >= 0 && (!targetVersion || targetVersion.startsWith("--"))) throw new Error("--target-version requires a stable X.Y.Z version");
const { series } = JSON.parse(readFileSync(new URL("../../config/release-series.json", import.meta.url), "utf8"));
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
const packagingChanged = changedFiles.some(
  (file) =>
    file === "nodejs/scripts/pack-publishable-package.mjs" ||
    file === "nodejs/scripts/publish-versioned-packages.mjs"
);

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

// The publish packer determines the manifest inside every npm tarball. When
// it changes, existing registry releases cannot be repaired in place, so all
// public packages need a new patch release with the corrected artifact.
if (packagingChanged || targetVersion || changedFiles.includes("config/release-series.json")) {
  for (const { manifest } of allPackages) {
    changedPackages.add(manifest.name);
    dependencyRoots.add(manifest.name);
  }
}

const releaseNames = new Set([
  ...changedPackages,
  ...releaseClosure(allPackages.map(({ manifest }) => manifest), dependencyRoots),
]);

const packages = allPackages.filter(({ manifest }) => releaseNames.has(manifest.name));
const released = [];

// Resolve every version before modifying any manifest: a conflict or registry
// outage must leave the checkout untouched.
for (const { manifest } of packages) {
  const prefix = `${manifest.name}@`;
  const tagged = execFileSync("git", ["tag", "-l", `${prefix}*`], { cwd: root, encoding: "utf8" })
    .trim().split("\n").filter(Boolean).map((tag) => tag.slice(prefix.length));
  let published = [];
  try {
    const result = JSON.parse(execFileSync("npm", ["view", manifest.name, "versions", "--json"], {
      cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    }));
    published = Array.isArray(result) ? result : [result];
  } catch (error) {
    let code;
    try { code = JSON.parse(String(error.stdout)).error?.code; } catch { /* not a registry JSON error */ }
    if (code !== "E404") throw new Error(`Unable to verify registry versions for ${manifest.name}`, { cause: error });
  }
  const version = nextReleaseVersion({ baseline: manifest.version, published, tagged, targetVersion, series });
  released.push({ name: manifest.name, version });
}

if (!dryRun) {
  for (const { manifestPath, manifest } of packages) {
    manifest.version = released.find(({ name }) => name === manifest.name).version;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);
  }
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
