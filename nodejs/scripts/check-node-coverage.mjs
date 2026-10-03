import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

// Generated wasm-pack output is covered by Rust llvm-cov.  The authored core
// runtime facade and every TypeScript package must meet the same four-metric
// floor. Limiting coverage to src prevents generated dist/
// and a previous HTML report from changing the result.
const defaultPackages = [
  "mdi-core",
  "cli",
  "export-profile",
  "mdast-util-mdi",
  "mdi",
  "remark",
  "to-docx",
  "to-epub",
  "to-hast",
  "to-html",
  "to-pdf",
];

const selectedPackages = process.env.MDI_COVERAGE_PACKAGES
  ? process.env.MDI_COVERAGE_PACKAGES.split(",").filter(Boolean)
  : defaultPackages;

for (const packageName of selectedPackages) {
  if (!defaultPackages.includes(packageName)) {
    throw new Error(`Unknown coverage package: ${packageName}`);
  }

  const packageDirectory = resolve(repositoryRoot, "nodejs", "packages", packageName);
  if (!existsSync(resolve(packageDirectory, "src"))) {
    throw new Error(`Missing source directory for ${packageName}`);
  }

  console.log(`\n=== Node coverage: ${packageName} ===`);
  const coverageInclude = packageName === "mdi-core"
    ? "src/runtime.js"
    : "src/**/*.{ts,js}";
  execFileSync(
    "pnpm",
    [
      "--dir",
      packageDirectory,
      "exec",
      "vitest",
      "run",
      "--coverage",
      "--coverage.reporter=lcov",
      "--coverage.reporter=text",
      `--coverage.include=${coverageInclude}`,
      "--coverage.thresholds.lines=90",
      "--coverage.thresholds.functions=90",
      "--coverage.thresholds.branches=90",
      "--coverage.thresholds.statements=90",
    ],
    { cwd: repositoryRoot, stdio: "inherit" },
  );
}
