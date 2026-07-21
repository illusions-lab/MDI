#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { build, loadExportProfile, parseArgs } from "./index.js";

/** Execute the command adapter without owning parsing or rendering semantics. */
export async function run(argv = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv.slice(1));
  if (!args || argv[0] !== "build") {
    console.error(
      "Usage: mdi build <input.mdi> --to html|pdf|epub|docx|txt|txt-ruby|narou|kakuyomu|aozora|txt-all [--config export.json] [-o <output>]"
    );
    return 1;
  }
  try {
    const output = await build(args.input, args.format, {
      output: args.output,
      profile: await loadExportProfile(args.config),
    });
    for (const path of Array.isArray(output) ? output : [output]) console.log(`Written ${path}`);
    return 0;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

export function isCliEntrypoint(moduleUrl: string, invokedPath = process.argv[1]): boolean {
  return Boolean(
    invokedPath && moduleUrl === pathToFileURL(realpathSync(invokedPath)).href
  );
}

export async function setCliExitCode(
  command: () => Promise<number> = run
): Promise<void> {
  process.exitCode = await command();
}

// npm exposes bins through `node_modules/.bin` symlinks. Resolve that link
// before comparing URLs so the packaged CLI, not only a direct source invoke,
// runs its command handler.
if (isCliEntrypoint(import.meta.url)) await setCliExitCode();
