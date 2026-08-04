import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [inputDirectory, outputDirectory] = process.argv.slice(2);
if (!inputDirectory || !outputDirectory) {
  throw new Error("usage: node scripts/write-large-document-performance-report.mjs <input-dir> <output-dir>");
}

const expectedCharacters = [100_000, 1_000_000, 10_000_000, 100_000_000];
const reportFiles = (await readdir(inputDirectory, { recursive: true }))
  .filter((file) => file.endsWith(".jsonl"));
const results = [];

for (const file of reportFiles) {
  const lines = (await readFile(resolve(inputDirectory, file), "utf8"))
    .split("\n")
    .filter(Boolean);
  for (const line of lines) {
    results.push(JSON.parse(line));
  }
}

results.sort((left, right) => left.characters - right.characters);
if (results.length !== expectedCharacters.length || !results.every((result, index) => result.characters === expectedCharacters[index])) {
  throw new Error(`expected one result for ${expectedCharacters.join(", ")} characters; received ${results.map((result) => result.characters).join(", ")}`);
}

const report = {
  schemaVersion: 1,
  commit: process.env.GITHUB_SHA ?? "local",
  runId: process.env.GITHUB_RUN_ID ?? "local",
  runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? "1",
  generatedAt: new Date().toISOString(),
  results,
};
const tableRows = results.map((result) => [
  result.characters.toLocaleString("en-US"),
  result.source_bytes.toLocaleString("en-US"),
  result.canonical_bytes.toLocaleString("en-US"),
  result.parse_ms.toLocaleString("en-US"),
  result.serialize_ms.toLocaleString("en-US"),
  Math.round(result.parse_chars_per_second).toLocaleString("en-US"),
  Math.round(result.serialize_chars_per_second).toLocaleString("en-US"),
]);
const markdown = [
  "# Large-document performance report",
  "",
  `- Commit: \`${report.commit}\``,
  `- CI run: ${report.runId} (attempt ${report.runAttempt})`,
  `- Generated: ${report.generatedAt}`,
  "",
  "| Characters | Source bytes | Canonical bytes | Parse ms | Serialize ms | Parse chars/s | Serialize chars/s |",
  "| ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...tableRows.map((row) => `| ${row.join(" | ")} |`),
  "",
  "Compare this artifact with earlier CI runs for the same runner class; throughput is reported rather than hard-gated because GitHub-hosted CPU allocation varies.",
  "",
].join("\n");

await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, "large-document-performance.json"), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(resolve(outputDirectory, "large-document-performance.md"), markdown);
