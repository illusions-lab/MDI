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
  const [major, minor] = manifest.version.split(".");
  if (!/^\d+$/.test(major) || !/^\d+$/.test(minor)) {
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
  const nextVersion = `${major}.${minor}.${
    patches.length === 0 ? 1 : Math.max(...patches) + 1
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
