import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

// YAML is already a declared dependency of the JavaScript MDI binding.  Load
// it from that package's resolution context rather than adding a root-only
// runtime dependency for this repository verification script.
const require = createRequire(
  new URL("../nodejs/packages/mdi/package.json", import.meta.url),
);
const { parse } = require("yaml");

const [yamlSource, typescriptSource] = await Promise.all([
  readFile(new URL("../config/publication-layouts.yaml", import.meta.url), "utf8"),
  readFile(new URL("../nodejs/packages/export-profile/src/index.ts", import.meta.url), "utf8"),
]);
const config = parse(yamlSource);
if (config?.version !== 1 || config?.units !== "mm" || !config.paperSizes || !config.paperSizeLabels?.ja)
  throw new Error("publication-layouts.yaml must declare version 1, mm units, paperSizes, and Japanese labels");

const staticSizes = new Map(
  [...typescriptSource.matchAll(/^\s*(?:"([^"]+)"|(\w+)):\s*\{ width: (\d+), height: (\d+) \},$/gm)]
    .map((match) => [match[1] ?? match[2], { widthMm: Number(match[3]), heightMm: Number(match[4]) }]),
);
for (const [name, size] of Object.entries(config.paperSizes)) {
  const expected = staticSizes.get(name);
  if (!expected || expected.widthMm !== size.widthMm || expected.heightMm !== size.heightMm)
    throw new Error(`Paper size mismatch for ${name}`);
}
if (staticSizes.size !== Object.keys(config.paperSizes).length)
  throw new Error("publication-layouts.yaml must list every PAGE_DIMENSIONS entry");

const labelBlock = typescriptSource.match(
  /export const PAGE_SIZE_LABELS = \{\n  ja: \{([\s\S]*?)\n  \},\n\} as const/,
)?.[1];
if (!labelBlock) throw new Error("PAGE_SIZE_LABELS.ja must be exported");
const staticLabels = new Map(
  [...labelBlock.matchAll(/(?:"([^"]+)"|(\w+)):\s*"([^"]+)"/g)]
    .map((match) => [match[1] ?? match[2], match[3]]),
);
for (const name of Object.keys(config.paperSizes)) {
  if (typeof config.paperSizeLabels.ja[name] !== "string" || !staticLabels.get(name))
    throw new Error(`Japanese paper-size label missing for ${name}`);
  if (staticLabels.get(name) !== config.paperSizeLabels.ja[name])
    throw new Error(`Japanese paper-size label mismatch for ${name}`);
}
if (staticLabels.size !== Object.keys(config.paperSizes).length ||
  Object.keys(config.paperSizeLabels.ja).length !== Object.keys(config.paperSizes).length)
  throw new Error("Japanese paper-size labels must cover every PAGE_DIMENSIONS entry");

const vertical = config.layouts?.["japanese-publisher"]?.vertical;
const horizontal = config.layouts?.word?.horizontal;
if (
  vertical?.pageSize !== "A4" || vertical?.landscape !== true ||
  vertical?.grid?.charactersPerLine !== 40 || vertical?.grid?.linesPerPage !== 30 ||
  vertical?.binding?.side !== "right" || horizontal?.pageSize !== "A4" ||
  horizontal?.gridMode !== "typographic"
) throw new Error("publication layout defaults are incomplete or inconsistent");

console.log(`Verified ${staticSizes.size} shared paper sizes and CLI layout defaults.`);
