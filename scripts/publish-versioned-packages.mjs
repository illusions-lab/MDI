import { appendFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { globSync } from "node:fs";
import { dirname, join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const manifests = globSync(join(root, "packages", "*", "package.json"));
const pending = [];
const releasePackages = [];
const dryRun = process.argv.includes("--dry-run");

for (const manifestPath of manifests) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.private) continue;
  releasePackages.push({ name: manifest.name, version: manifest.version });
  try {
    execFileSync(
      "npm",
      ["view", `${manifest.name}@${manifest.version}`, "version"],
      {
        cwd: root,
        stdio: "ignore",
      }
    );
  } catch {
    pending.push({ name: manifest.name, manifestPath });
  }
}

if (pending.length > 0 && !dryRun) {
  execFileSync("pnpm", ["run", "build"], { cwd: root, stdio: "inherit" });
  for (const { manifestPath } of pending) {
    execFileSync("pnpm", ["publish", "--no-git-checks", "--access", "public"], {
      cwd: dirname(manifestPath),
      stdio: "inherit",
    });
  }
}

if (process.env.GITHUB_OUTPUT) {
  // A manual dispatch is also used to repair/create GitHub Releases for
  // versions already on npm. The release script is idempotent and skips tags
  // that already exist.
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `published=${releasePackages.length > 0}\n`
  );
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `publishedPackages=${JSON.stringify(releasePackages)}\n`
  );
}

console.log(
  pending.length > 0
    ? `${dryRun ? "Would publish" : "Published"} ${pending
        .map(({ name }) => name)
        .join(", ")}`
    : "No unpublished workspace packages."
);
