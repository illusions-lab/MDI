import { readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import iconv from "iconv-lite";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdi from "@illusions-lab/mdi-remark";
import {
  parseExportProfileJson,
  resolveExportProfile,
  type ExportProfile,
} from "@illusions-lab/mdi-export-profile";
import type { Root, RootContent, PhrasingContent } from "mdast";
import type {} from "mdast-util-mdi";
import type {} from "@illusions-lab/mdi-remark";

export const MDI_SPEC_VERSION = "2.0";
export type OutputFormat =
  | "html"
  | "pdf"
  | "epub"
  | "docx"
  | "txt"
  | "txt-ruby"
  | "narou"
  | "kakuyomu"
  | "aozora"
  | "txt-all";
type TextOutputFormat = Extract<OutputFormat, "txt" | "txt-ruby" | "narou" | "kakuyomu" | "aozora">;
const TEXT_OUTPUT_FORMATS: readonly TextOutputFormat[] = ["txt", "txt-ruby", "narou", "kakuyomu", "aozora"];
export interface BuildOptions {
  output?: string;
  profile?: ExportProfile;
}

export function build(
  input: string,
  format: "txt-all",
  options?: BuildOptions | string
): Promise<string[]>;
export function build(
  input: string,
  format: Exclude<OutputFormat, "txt-all">,
  options?: BuildOptions | string
): Promise<string>;
export function build(
  input: string,
  format: OutputFormat,
  options?: BuildOptions | string
): Promise<string | string[]>;
export async function build(
  input: string,
  format: OutputFormat,
  options: BuildOptions | string = {}
): Promise<string | string[]> {
  const resolvedOptions =
    typeof options === "string" ? { output: options } : options;
  const source = await readFile(input, "utf8");
  const processor = unified().use(remarkParse).use(remarkMdi);
  const tree = processor.runSync(processor.parse(source)) as Root;
  if (format === "txt-all") {
    if (resolvedOptions.output)
      throw new Error("--to txt-all does not accept -o; it writes all text formats next to the input file");
    const outputs = await Promise.all(
      TEXT_OUTPUT_FORMATS.map(async (textFormat) => {
        const destination = defaultOutputPath(input, textFormat, "txt");
        await writeTextOutput(destination, mdiToTextFormat(tree, resolvedOptions.profile, textFormat), textFormat);
        return resolve(destination);
      })
    );
    return outputs;
  }
  const result =
    format === "html"
      ? (await import("@illusions-lab/mdi-to-html")).mdiToHtml(tree)
      : format === "pdf"
      ? await (
          await import("@illusions-lab/mdi-to-pdf")
        ).mdiToPdf(tree, resolvedOptions.profile)
      : format === "epub"
      ? await (
          await import("@illusions-lab/mdi-to-epub")
        ).mdiToEpub(tree, {
          profile: resolvedOptions.profile,
          cover: await loadCover(resolvedOptions.profile),
        })
      : format === "docx"
      ? await exportDocx(tree, resolvedOptions.profile)
      : mdiToTextFormat(tree, resolvedOptions.profile, format);
  const extension = isTextFormat(format) ? "txt" : format;
  const destination =
    resolvedOptions.output ??
    defaultOutputPath(input, format, extension);
  if (isTextFormat(format)) {
    await writeTextOutput(destination, result as string, format);
  } else {
    await writeFile(destination, result);
  }
  return resolve(destination);
}

export interface CliArgs {
  input: string;
  format: OutputFormat;
  output?: string;
  config?: string;
}
export function parseArgs(args: string[]): CliArgs | undefined {
  const [input, ...tail] = args;
  if (!input) return undefined;
  let format: OutputFormat | undefined;
  let output: string | undefined;
  let config: string | undefined;
  for (let index = 0; index < tail.length; index += 2) {
    const flag = tail[index];
    const value = tail[index + 1];
    if (!value) return undefined;
    if (flag === "--to" && isFormat(value) && !format) format = value;
    else if (flag === "-o" && !output) output = value;
    else if (flag === "--config" && !config) config = value;
    else return undefined;
  }
  return format
    ? {
        input,
        format,
        ...(output ? { output } : {}),
        ...(config ? { config } : {}),
      }
    : undefined;
}

export async function loadExportProfile(
  configPath?: string
): Promise<ExportProfile | undefined> {
  if (!configPath) return undefined;
  const profile = parseExportProfileJson(await readFile(configPath, "utf8"));
  if (profile.epub.coverPath)
    profile.epub.coverPath = resolve(
      dirname(configPath),
      profile.epub.coverPath
    );
  return profile;
}

/** Plain text and ruby-preserving text exports share the profile's U+3000 indentation. */
export function mdiToText(
  tree: Root,
  profile?: ExportProfile,
  ruby = false
): string {
  const settings = resolveExportProfile(profile).text;
  const prefix = settings.fullwidthSpaceIndent
    ? "　".repeat(settings.indentCount)
    : "";
  return renderText(tree, ruby ? "txt-ruby" : "txt", prefix);
}

/** Text renderers for ordinary plain text and Japanese publication platforms. */
export function mdiToTextFormat(tree: Root, profile: ExportProfile | undefined, format: TextOutputFormat): string {
  const settings = resolveExportProfile(profile).text;
  const prefix = settings.fullwidthSpaceIndent ? "　".repeat(settings.indentCount) : "";
  const text = renderText(tree, format, prefix);
  return format === "aozora" ? text.replaceAll("\n", "\r\n") : text;
}

async function writeTextOutput(destination: string, text: string, format: TextOutputFormat): Promise<void> {
  await writeFile(
    destination,
    format === "aozora" ? iconv.encode(normalizeAozoraShiftJis(text), "shift_jis") : text
  );
}

/**
 * Aozora Bunko's Shift_JIS workflow cannot encode U+2014 EM DASH.  Japanese
 * manuscripts commonly use paired em dashes, so preserve both characters by
 * converting each one to the Shift_JIS-compatible U+2015 HORIZONTAL BAR.
 */
function normalizeAozoraShiftJis(text: string): string {
  return text.replaceAll("\u2014", "\u2015");
}

function defaultOutputPath(input: string, format: OutputFormat, extension: string): string {
  const stem = input.slice(0, input.length - extname(input).length);
  const suffix = format === "txt" ? "" : isTextFormat(format) ? `_${format.replace("txt-", "")}` : "";
  return `${stem}${suffix}.${extension}`;
}
function isTextFormat(format: OutputFormat): format is TextOutputFormat {
  return TEXT_OUTPUT_FORMATS.includes(format as TextOutputFormat);
}

async function loadCover(
  profile: ExportProfile | undefined
): Promise<
  { data: Uint8Array; mediaType: "image/jpeg" | "image/png" } | undefined
> {
  const coverPath = profile
    ? resolveExportProfile(profile).epub.coverPath
    : undefined;
  if (!coverPath) return undefined;
  const extension = extname(coverPath).toLowerCase();
  if (extension !== ".jpg" && extension !== ".jpeg" && extension !== ".png")
    throw new Error("EPUB cover must be a JPEG or PNG file");
  return {
    data: await readFile(coverPath),
    mediaType: extension === ".png" ? "image/png" : "image/jpeg",
  };
}

/**
 * Node 25+ exposes `localStorage` behind an experimental getter. `docx` checks
 * that global while loading an optional browser polyfill, which otherwise emits
 * a warning for every CLI conversion. The CLI does not use web storage.
 */
async function exportDocx(
  tree: Root,
  profile?: ExportProfile
): Promise<Buffer> {
  Object.defineProperty(globalThis, "localStorage", {
    value: undefined,
    configurable: true,
    writable: true,
  });
  return (await import("@illusions-lab/mdi-to-docx")).mdiToDocx(tree, profile);
}

function renderText(tree: Root, format: TextOutputFormat, prefix: string): string {
  const defs = new Map(tree.children.filter((node) => node.type === "footnoteDefinition").map((node) => [node.identifier, node]));
  const blocks = tree.children.flatMap((node) => textBlock(node, format, prefix, defs));
  const footnotes = format === "txt" || format === "txt-ruby" ? [] : [...defs.values()].map((node, index) => `${index + 1}. ${node.children.map((child) => child.type === "paragraph" ? inlineText(child.children, format, defs) : "").join(" ")}`);
  return [...blocks, ...(footnotes.length ? ["", "Footnotes", ...footnotes] : [])].join("\n");
}
function textBlock(node: RootContent, format: TextOutputFormat, prefix: string, defs: Map<string, Extract<RootContent, { type: "footnoteDefinition" }>>): string[] {
  if (node.type === "footnoteDefinition") return [];
  if (node.type === "paragraph") return [`${prefix}${inlineText(node.children, format, defs)}`];
  if (node.type === "heading") {
    const value = inlineText(node.children, format, defs);
    if (format === "aozora") return [`${value}［＃「${value}」は${node.depth === 1 ? "大" : node.depth === 2 ? "中" : "小"}見出し］`];
    return [value];
  }
  if (node.type === "list") return node.children.flatMap((item, index) => item.children.flatMap((child) => child.type === "paragraph" ? [`${prefix}${node.ordered ? `${index + 1}. ` : "- "}${inlineText(child.children, format, defs)}`] : textBlock(child, format, prefix, defs)));
  if (node.type === "blockquote") return node.children.flatMap((child) => textBlock(child, format, prefix, defs));
  if (node.type === "code") return node.value.split("\n");
  if (node.type === "table") return node.children.map((row) => row.children.map((cell) => inlineText(cell.children, format, defs)).join("\t"));
  if (node.type === "thematicBreak") return ["――――――"];
  if (node.type === "mdiBlank" || node.type === "mdiPagebreak") return [""];
  return [];
}
function inlineText(nodes: PhrasingContent[], format: TextOutputFormat, defs: Map<string, Extract<RootContent, { type: "footnoteDefinition" }>>): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return node.value;
      if (node.type === "break" || node.type === "mdiBreak") return "\n";
      if (node.type === "mdiRuby")
        return format === "txt" ? node.base : format === "txt-ruby" ? `{${node.base}|${Array.isArray(node.ruby) ? node.ruby.join(".") : node.ruby}}` : `｜${node.base}《${Array.isArray(node.ruby) ? node.ruby.join("") : node.ruby}》`;
      if (node.type === "mdiEm") {
        const value = inlineText(node.children as PhrasingContent[], format, defs);
        return format === "aozora" ? `${value}［＃「${value}」に傍点］` : format === "kakuyomu" ? `《《${value}》》` : value;
      }
      if (node.type === "mdiTcy") return node.value;
      if (node.type === "inlineCode") return node.value;
      if (node.type === "image") return node.alt ? `[画像: ${node.alt}]` : "[画像]";
      if (node.type === "footnoteReference") return format === "txt" || format === "txt-ruby" ? "" : `［注${[...defs.keys()].indexOf(node.identifier) + 1}］`;
      if ("children" in node)
        return inlineText(node.children as PhrasingContent[], format, defs);
      return "";
    })
    .join("");
}
function isFormat(value: string): value is OutputFormat {
  return (
    value === "html" ||
    value === "pdf" ||
    value === "epub" ||
    value === "docx" ||
    value === "txt" ||
    value === "txt-ruby" ||
    value === "narou" ||
    value === "kakuyomu" ||
    value === "aozora" ||
    value === "txt-all"
  );
}
