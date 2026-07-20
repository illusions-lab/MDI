import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

// `mdi-core` is WebAssembly generated from Rust and is covered by the Rust
// llvm-cov gate. Every package below owns TypeScript source and must meet the
// same four-metric floor. Limiting coverage to src prevents generated dist/
// and a previous HTML report from changing the result.
const defaultPackages = [
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
      "--coverage.include=src/**/*.ts",
      "--coverage.thresholds.lines=90",
      "--coverage.thresholds.functions=90",
      "--coverage.thresholds.branches=90",
      "--coverage.thresholds.statements=90",
    ],
    { cwd: repositoryRoot, stdio: "inherit" },
  );
}
