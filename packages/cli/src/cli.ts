#!/usr/bin/env node
import { build, loadExportProfile, parseArgs } from "./index.js";

const args = parseArgs(process.argv.slice(3));
if (!args || process.argv[2] !== "build") {
  console.error(
    "Usage: mdi build <input.mdi> --to html|pdf|epub|docx|txt|txt-ruby [--config export.json] [-o <output>]"
  );
  process.exitCode = 1;
} else {
  try {
    const output = await build(args.input, args.format, {
      output: args.output,
      profile: await loadExportProfile(args.config),
    });
    console.log(`Written ${output}`);
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
