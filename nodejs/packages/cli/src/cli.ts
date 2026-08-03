#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { parse } from "@illusions-lab/mdi";
import { build, loadExportProfile, parseCommand } from "./index.js";
import { compareVersions, currentVersion, installLatest, latestVersion } from "./version.js";

const FORMAT_BY_EXTENSION: Record<string, string> = {
  html: "html", htm: "html", json: "json", pdf: "pdf", epub: "epub", docx: "docx", txt: "txt",
};

export const HELP = `Usage: mdi <command> [options]
Usage: mdi build <input.mdi> --to <format>

Commands:
  Build
    mdi <input.mdi> [--to <format>] [-o, --output <file>] [--config <file>]
    mdi build <input.mdi> [--to <format>] [-o, --output <file>] [--config <file>]
      Formats: html, json, pdf, epub, docx, txt, txt-ruby, narou, kakuyomu,
               aozora, note, txt-all (default: html)

  Check
    mdi check <input.mdi>     Parse and print diagnostics

  Update
    mdi update                 Check for the latest version and ask to update
    mdi update --check         Check only; never install
    mdi update --yes           Install without confirmation

  Version and help
    mdi --version              Print the installed CLI version
    mdi --help, -h             Show this help

  Options:
  --to <format>       Select an output format
  -o, --output <file> Write to a specific path (its extension can select format)
  --config <file>     EPUB/DOCX/PDF export profile JSON
  -y, --yes           Confirm an update without prompting

Format details:
  json       Write the versioned MDI document IR and diagnostics as JSON
  html       Write a standalone HTML document
  pdf        Write a PDF using Chromium for layout
  epub       Write an EPUB 3 archive
  docx       Write a DOCX document
  txt        Write plain text; txt-ruby, narou, kakuyomu, aozora, note are
             platform-specific text variants; txt-all writes every variant

Examples:
  mdi novel.mdi
  mdi book.mdi --to json
  mdi build novel.mdi --to epub -o novel.epub
  mdi check novel.mdi
  mdi update --check

Update checks are non-blocking and cached once per day. Registry failures never
change the result of a build or check. Set MDI_NO_UPDATE_CHECK=1 to disable them.`;

function printDiagnostics(inputPath: string, diagnostics: Array<{ severity: string; code: string; message: string; span?: { startByte: number; endByte: number } }>): boolean {
  for (const diagnostic of diagnostics) {
    const span = diagnostic.span ? ` [bytes ${diagnostic.span.startByte}-${diagnostic.span.endByte}]` : "";
    console.log(`${diagnostic.severity}: ${diagnostic.code}: ${diagnostic.message}${span} (${inputPath})`);
  }
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

async function updateCommand(checkOnly: boolean, yes: boolean): Promise<number> {
  const installed = currentVersion();
  let latest: string;
  try {
    latest = await latestVersion();
  } catch (error) {
    console.error(`Unable to check for updates: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  console.log(`Current version: ${installed}`);
  console.log(`Latest version: ${latest}`);
  if (compareVersions(latest, installed) <= 0 || checkOnly) return 0;
  if (!yes && (!input.isTTY || !output.isTTY)) {
    console.error(`Update available. Run: npm install --global @illusions-lab/mdi-cli@latest`);
    return 0;
  }
  if (!yes) {
    const readline = createInterface({ input, output });
    try {
      const answer = await readline.question("Proceed? [y/N] ");
      if (!/^y(?:es)?$/i.test(answer.trim())) return 0;
    } finally { readline.close(); }
  }
  try {
    await installLatest();
    const updated = currentVersion();
    console.log(`Update complete. Current version: ${updated}`);
    return compareVersions(updated, latest) >= 0 ? 0 : 1;
  } catch (error) {
    console.error(`Update failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

function hasOutputFormatConflict(argv: string[]): boolean {
  const formatIndex = argv.indexOf("--to");
  const outputIndex = argv.findIndex((value) => value === "-o" || value === "--output");
  if (formatIndex < 0 || outputIndex < 0) return false;
  const format = argv[formatIndex + 1];
  const output = argv[outputIndex + 1];
  if (!format || !output) return false;
  const extension = output.split(/[\\/]/).pop()?.split(".").pop()?.toLowerCase();
  return Boolean(extension && FORMAT_BY_EXTENSION[extension] && FORMAT_BY_EXTENSION[extension] !== format);
}

/** Execute the CLI command adapter. */
export async function run(argv = process.argv.slice(2)): Promise<number> {
  const command = parseCommand(argv);
  if (!command) {
    const detail = hasOutputFormatConflict(argv)
      ? "--to format conflicts with the output filename extension"
      : "Invalid command.";
    console.error(`${HELP}\n${detail}`);
    return 1;
  }
  if (command.command === "help") { console.log(HELP); return 0; }
  if (command.command === "version") { console.log(currentVersion()); return 0; }
  if (command.command === "update") return updateCommand(command.checkOnly, command.yes);
  if (command.command === "check") {
    try {
      const result = parse(await (await import("node:fs/promises")).readFile(command.input, "utf8"));
      return printDiagnostics(command.input, result.diagnostics) ? 1 : 0;
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); return 1; }
  }
  try {
    const built = await build(command.args.input, command.args.format, {
      output: command.args.output,
      profile: await loadExportProfile(command.args.config),
    });
    for (const path of Array.isArray(built) ? built : [built]) console.log(`Written ${path}`);
    return 0;
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); return 1; }
}

async function notifyUpdate(): Promise<void> {
  if (process.env.MDI_NO_UPDATE_CHECK === "1") return;
  try {
    const latest = await latestVersion();
    if (compareVersions(latest, currentVersion()) > 0) {
      console.error(`A newer mdi CLI is available (${currentVersion()} → ${latest}). Run: npm install --global @illusions-lab/mdi-cli@latest`);
    }
  } catch { /* update checks must never affect the command */ }
}

export function isCliEntrypoint(moduleUrl: string, invokedPath = process.argv[1]): boolean {
  return Boolean(invokedPath && moduleUrl === pathToFileURL(realpathSync(invokedPath)).href);
}

export async function setCliExitCode(command: () => Promise<number> = run): Promise<void> {
  process.exitCode = await command();
  // Do not make the update check part of the command's critical path.
  if (isCliEntrypoint(import.meta.url) && process.env.MDI_NO_UPDATE_CHECK !== "1") void notifyUpdate();
}

if (isCliEntrypoint(import.meta.url)) await setCliExitCode();
