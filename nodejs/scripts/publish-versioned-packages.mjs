import { appendFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { globSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Packages stay in nodejs/, while the pnpm workspace moved to the repository
// root. Keep those two locations explicit: publishing a package must build the
// root workspace, not an obsolete nodejs/package.json.
const packagesRoot = resolve(new URL("..", import.meta.url).pathname);
const repositoryRoot = resolve(packagesRoot, "..");
const manifests = globSync(join(packagesRoot, "packages", "*", "package.json"));
const pending = [];
const releasePackages = [];
const dryRun = process.argv.includes("--dry-run");
const selectedPackages = JSON.parse(process.env.RELEASE_PACKAGES ?? "[]");
const selectedNames = new Set(selectedPackages.map(({ name }) => name));

for (const manifestPath of manifests) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.private || !selectedNames.has(manifest.name)) continue;
  releasePackages.push({ name: manifest.name, version: manifest.version });
  try {
    execFileSync(
      "npm",
      ["view", `${manifest.name}@${manifest.version}`, "version"],
      {
        cwd: packagesRoot,
        stdio: "ignore",
      }
    );
  } catch {
    pending.push({ name: manifest.name, manifestPath });
  }
}

if (pending.length > 0 && !dryRun) {
  execFileSync("pnpm", ["run", "build"], {
    cwd: repositoryRoot,
    stdio: "inherit",
  });
  for (const { manifestPath } of pending) {
    // npm CLI detects GitHub Actions OIDC and exchanges it for a short-lived
    // publish credential. Do not replace this with pnpm publish: trusted
    // publishing authentication is implemented by npm itself.
    execFileSync("npm", ["publish", "--access", "public"], {
      cwd: dirname(manifestPath),
      stdio: "inherit",
    });
  }
}

if (process.env.GITHUB_OUTPUT) {
  // A manual dispatch is also used to repair/create GitHub Releases for
  // versions already on npm. The release script is idempotent and skips tags
  // that already exist.
  appendFileSync(process.env.GITHUB_OUTPUT, `published=${pending.length > 0}\n`);
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
