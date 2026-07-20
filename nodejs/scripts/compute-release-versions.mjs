import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { globSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dryRun = process.argv.includes("--dry-run");
const packages = globSync(join(root, "packages", "*", "package.json"))
  .map((manifestPath) => ({
    manifestPath,
    manifest: JSON.parse(readFileSync(manifestPath, "utf8")),
  }))
  .filter(({ manifest }) => !manifest.private)
  .sort(({ manifest: a }, { manifest: b }) => a.name.localeCompare(b.name));

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
  `${dryRun ? "Would release" : "Prepared release"} ${released
    .map(({ name, version }) => `${name}@${version}`)
    .join(", ")}`
);
