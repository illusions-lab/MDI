import { readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
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
  | "txt-ruby";
export interface BuildOptions {
  output?: string;
  profile?: ExportProfile;
}

export async function build(
  input: string,
  format: OutputFormat,
  options: BuildOptions | string = {}
): Promise<string> {
  const resolvedOptions =
    typeof options === "string" ? { output: options } : options;
  const source = await readFile(input, "utf8");
  const processor = unified().use(remarkParse).use(remarkMdi);
  const tree = processor.runSync(processor.parse(source)) as Root;
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
      ? await (
          await import("@illusions-lab/mdi-to-docx")
        ).mdiToDocx(tree, resolvedOptions.profile)
      : mdiToText(tree, resolvedOptions.profile, format === "txt-ruby");
  const extension = format === "txt-ruby" ? "txt" : format;
  const destination =
    resolvedOptions.output ??
    input.slice(0, input.length - extname(input).length) + `.${extension}`;
  await writeFile(destination, result);
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
  return tree.children
    .map((node) => textBlock(node, ruby, prefix))
    .filter((value) => value !== undefined)
    .join("\n");
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

function textBlock(
  node: RootContent,
  ruby: boolean,
  prefix: string
): string | undefined {
  if (node.type === "paragraph")
    return `${prefix}${inlineText(node.children, ruby)}`;
  if (node.type === "heading") return inlineText(node.children, ruby);
  if (node.type === "list")
    return node.children
      .map((item) =>
        item.children
          .filter((child) => child.type === "paragraph")
          .map((child) => `${prefix}${inlineText(child.children, ruby)}`)
          .join("\n")
      )
      .join("\n");
  if (node.type === "mdiBlank" || node.type === "mdiPagebreak") return "";
  return undefined;
}
function inlineText(nodes: PhrasingContent[], ruby: boolean): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return node.value;
      if (node.type === "break" || node.type === "mdiBreak") return "\n";
      if (node.type === "mdiRuby")
        return ruby
          ? `{${node.base}|${
              Array.isArray(node.ruby) ? node.ruby.join(".") : node.ruby
            }}`
          : node.base;
      if ("children" in node)
        return inlineText(node.children as PhrasingContent[], ruby);
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
    value === "txt-ruby"
  );
}
