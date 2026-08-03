import { readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import iconv from "iconv-lite";
import {
  parseExportProfileJson,
  resolveExportProfile,
  type ExportProfile,
} from "@illusions-lab/mdi-export-profile";
import {
  renderDocxWithProfile,
  renderEpubWithProfile,
  renderHtml,
  renderTextFormat,
  parse,
  type EpubCover,
} from "@illusions-lab/mdi";

export {
  CACHE_TTL_MS,
  PACKAGE_NAME,
  REGISTRY_URL,
  compareVersions,
  currentVersion,
  defaultCacheFile,
  installLatest,
  latestVersion,
} from "./version.js";
export type { VersionCache, VersionServiceOptions } from "./version.js";

export const MDI_SPEC_VERSION = "2.0";
export type OutputFormat =
  | "json"
  | "html"
  | "pdf"
  | "epub"
  | "docx"
  | "txt"
  | "txt-ruby"
  | "narou"
  | "kakuyomu"
  | "aozora"
  | "note"
  | "txt-all";
type TextOutputFormat = Extract<OutputFormat, "txt" | "txt-ruby" | "narou" | "kakuyomu" | "aozora" | "note">;
const TEXT_OUTPUT_FORMATS: readonly TextOutputFormat[] = ["txt", "txt-ruby", "narou", "kakuyomu", "aozora", "note"];
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
  const publicationProfile =
    resolvedOptions.profile ?? defaultCliPublicationProfile(source);
  if (format === "txt-all") {
    if (resolvedOptions.output)
      throw new Error("--to txt-all does not accept -o; it writes all text formats next to the input file");
    const outputs = await Promise.all(
      TEXT_OUTPUT_FORMATS.map(async (textFormat) => {
        const destination = defaultOutputPath(input, textFormat, "txt");
        await writeTextOutput(destination, rustTextOutput(source, resolvedOptions.profile, textFormat), textFormat);
        return resolve(destination);
      })
    );
    return outputs;
  }
  if (isTextFormat(format)) {
    const destination =
      resolvedOptions.output ?? defaultOutputPath(input, format, "txt");
    await writeTextOutput(destination, rustTextOutput(source, resolvedOptions.profile, format), format);
    return resolve(destination);
  }
  if (format === "html") {
    const destination =
      resolvedOptions.output ?? defaultOutputPath(input, format, format);
    await writeFile(destination, renderHtml(source));
    return resolve(destination);
  }
  if (format === "json") {
    const destination =
      resolvedOptions.output ?? defaultOutputPath(input, format, format);
    await writeFile(destination, `${JSON.stringify(parse(source), null, 2)}\n`, "utf8");
    return resolve(destination);
  }
  const result =
    format === "pdf"
      ? await (
          await import("@illusions-lab/mdi-to-pdf")
        ).renderHtmlToPdf(renderHtml(source), publicationProfile)
      : format === "epub"
      ? await renderEpubWithProfile(source, {
          profile: publicationProfile,
          cover: await loadEpubCover(publicationProfile),
        })
      : format === "docx"
      ? await renderDocxWithProfile(source, publicationProfile)
      : (() => {
          throw new Error(`Unsupported output format: ${format}`);
        })();
  const extension = format;
  const destination =
    resolvedOptions.output ??
    defaultOutputPath(input, format, extension);
  await writeFile(destination, result);
  return resolve(destination);
}

/** CLI publication defaults: Japanese A4 manuscript for vertical, Word A4 for horizontal. */
function defaultCliPublicationProfile(source: string): ExportProfile {
  const writingMode = parse(source).document.frontmatter?.entries.find(
    (entry) => entry.key === "writing-mode" || entry.key === "writingMode",
  )?.value === "vertical" ? "vertical" : "horizontal";
  return {
    layout: {
      system: writingMode === "vertical" ? "japanese-publisher" : "word",
    },
    typesetting: { writingMode },
  };
}

function rustTextOutput(source: string, profile: ExportProfile | undefined, format: TextOutputFormat): string {
  const settings = resolveExportProfile(profile).text;
  const prefix = settings.fullwidthSpaceIndent ? "　".repeat(settings.indentCount) : "";
  return renderTextFormat(source, format, prefix);
}

export interface CliArgs {
  input: string;
  format: OutputFormat;
  output?: string;
  config?: string;
}

export type CliCommand =
  | { command: "build"; args: CliArgs }
  | { command: "check"; input: string }
  | { command: "update"; checkOnly: boolean; yes: boolean }
  | { command: "version" }
  | { command: "help" };

const OUTPUT_EXTENSIONS: Record<string, OutputFormat> = {
  html: "html", htm: "html", json: "json", pdf: "pdf", epub: "epub",
  docx: "docx", txt: "txt",
};

/** Parse the public command line, including shorthand `mdi input.mdi`. */
export function parseCommand(argv: string[]): CliCommand | undefined {
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") return { command: "help" };
  if (argv[0] === "build" && (argv[1] === "-h" || argv[1] === "--help")) return { command: "help" };
  if (argv[0] === "--version" || argv[0] === "-v") return argv.length === 1 ? { command: "version" } : undefined;
  if (argv[0] === "check") {
    return argv.length === 2 && !argv[1].startsWith("-") ? { command: "check", input: argv[1] } : undefined;
  }
  if (argv[0] === "update") {
    let checkOnly = false;
    let yes = false;
    for (const option of argv.slice(1)) {
      if (option === "--check") checkOnly = true;
      else if (option === "--yes" || option === "-y") yes = true;
      else if (option === "-h" || option === "--help") return { command: "help" };
      else return undefined;
    }
    return { command: "update", checkOnly, yes };
  }
  if (argv[0] !== "build" && !argv[0].toLowerCase().endsWith(".mdi")) return undefined;
  const buildArgv = argv[0] === "build" ? argv.slice(1) : argv;
  if (buildArgv.length === 0) return undefined;
  const input = buildArgv[0];
  let format: OutputFormat | undefined;
  let output: string | undefined;
  let config: string | undefined;
  for (let index = 1; index < buildArgv.length; index += 1) {
    const flag = buildArgv[index];
    if (flag === "-h" || flag === "--help") return { command: "help" };
    const value = buildArgv[index + 1];
    if (!value || value.startsWith("-")) return undefined;
    if (flag === "--to" && !format && isFormat(value)) format = value;
    else if ((flag === "-o" || flag === "--output") && !output) output = value;
    else if (flag === "--config" && !config) config = value;
    else return undefined;
    index += 1;
  }
  const inferred = format ?? (output ? OUTPUT_EXTENSIONS[extname(output).slice(1).toLowerCase()] : "html");
  if (!inferred) return undefined;
  if (output && format && OUTPUT_EXTENSIONS[extname(output).slice(1).toLowerCase()] &&
      OUTPUT_EXTENSIONS[extname(output).slice(1).toLowerCase()] !== format) return undefined;
  return { command: "build", args: { input, format: inferred, ...(output ? { output } : {}), ...(config ? { config } : {}) } };
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
    else if ((flag === "-o" || flag === "--output") && !output) output = value;
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

/** Load and identify the cover configured in an EPUB publication profile. */
async function loadEpubCover(profile: ExportProfile): Promise<EpubCover | undefined> {
  const path = profile.epub?.coverPath;
  if (!path) return undefined;
  const data = await readFile(path);
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a
  ) return { data, mediaType: "image/png" };
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { data, mediaType: "image/jpeg" };
  }
  throw new Error(`EPUB cover must be a PNG or JPEG image: ${path}`);
}

async function writeTextOutput(destination: string, text: string, format: TextOutputFormat): Promise<void> {
  await writeFile(
    destination,
    format === "aozora" ? encodeAozoraShiftJis(text) : text
  );
}

function encodeAozoraShiftJis(text: string): Buffer {
  const normalized = normalizeAozoraShiftJis(text);
  const unsupported = [...normalized].find((character) => {
    const encoded = iconv.encode(character, "shift_jis");
    return character !== "?" && encoded.length === 1 && encoded[0] === 0x3f;
  });
  if (unsupported) {
    const codePoint = unsupported.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0");
    throw new Error(
      `Aozora Bunko output cannot encode ${unsupported} (U+${codePoint}) as Shift_JIS; replace it or provide an official Aozora gaiji annotation`
    );
  }
  return iconv.encode(normalized, "shift_jis");
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

function isFormat(value: string): value is OutputFormat {
  return (
    value === "json" ||
    value === "html" ||
    value === "pdf" ||
    value === "epub" ||
    value === "docx" ||
    value === "txt" ||
    value === "txt-ruby" ||
    value === "narou" ||
    value === "kakuyomu" ||
    value === "aozora" ||
    value === "note" ||
    value === "txt-all"
  );
}
