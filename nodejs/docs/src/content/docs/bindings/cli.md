---
title: CLI
description: "@illusions-lab/mdi-cli — install, every flag, every output format's real behavior, and every error message."
---

**Prerequisites:** [Getting Started](/guides/getting-started/).

## What this binding solves

You have a `.mdi` file and want HTML, PDF, EPUB, DOCX, or one of five plain-text conventions, without writing any code. `mdi build` is a single command that calls the same Rust functions every other binding calls — it has no rendering logic of its own beyond choosing a file extension and writing bytes to disk.

## Install

```bash
npm install --global @illusions-lab/mdi-cli
```

This installs one binary, `mdi`, with one subcommand, `build`. There is no separate `help` or `version` subcommand today — running `mdi` with no arguments, or with an unrecognized `--to` value, prints the same usage line shown below and exits with status `1`.

## Every command and flag

```text
mdi build <input.mdi> --to html|pdf|epub|docx|txt|txt-ruby|narou|kakuyomu|aozora|txt-all [--config export.json] [-o <output>]
```

| Flag | Required | Meaning |
| --- | --- | --- |
| `<input.mdi>` | Yes | Path to the source file. Read as UTF-8. |
| `--to <format>` | Yes | One of the ten formats below. |
| `-o <path>` | No | Output file path. Omit it and the CLI derives one from the input path (see the table below). Incompatible with `--to txt-all`. |
| `--config <path>` | No | Path to an [export-profile](/ecosystem/export-profiles/) JSON file. |

## Minimal executable example

```bash
echo '{東京|とうきょう}は雨だった。' > novel.mdi
mdi build novel.mdi --to html
```

```text
Written /home/you/novel.html
```

```bash
cat novel.html
```

```html
<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><style>...</style></head><body><p><ruby class="mdi-ruby">東京<rp>（</rp><rt>とうきょう</rt><rp>）</rp></ruby>は雨だった。</p></body></html>
```

## Output formats, one at a time

| `--to` value | Default output path (no `-o`) | Rendered by |
| --- | --- | --- |
| `html` | `novel.html` | `renderHtml` (Rust) |
| `pdf` | `novel.pdf` | `renderHtml` (Rust) + Chromium `printToPDF` |
| `epub` | `novel.epub` | `renderEpub` (Rust) |
| `docx` | `novel.docx` | `renderDocx` (Rust) |
| `txt` | `novel.txt` | `renderTextFormat(..., "txt")` (Rust) — ruby discarded |
| `txt-ruby` | `novel_ruby.txt` | ruby kept as `{base\|reading}` |
| `narou` | `novel_narou.txt` | 小説家になろう submission notation |
| `kakuyomu` | `novel_kakuyomu.txt` | カクヨム submission notation |
| `aozora` | `novel_aozora.txt`, **Shift_JIS-encoded** | 青空文庫 (Aozora Bunko) annotation notation |
| `txt-all` | writes all six text files above; rejects `-o` | — |

HTML, every text format, EPUB, and DOCX are rendered **directly by the Rust core** — the CLI does not reparse or reinterpret anything between `renderX(source)` and `fs.writeFile`. PDF is the one format with an extra step: the CLI takes that same Rust-rendered HTML and hands it to `@illusions-lab/mdi-to-pdf`, which launches a local Chromium-family browser to lay it out and produce the PDF bytes — Chromium never receives `.mdi` source (see [Rendering model](/core/rendering/#the-chromiumpdf-boundary)).

## Text formats

Run any single flavor, or all five at once:

```bash
mdi build novel.mdi --to txt-ruby
mdi build novel.mdi --to aozora
mdi build novel.mdi --to txt-all
```

```text
Written /home/you/novel_ruby.txt
Written /home/you/novel_aozora.txt
Written /home/you/novel.txt
Written /home/you/novel_ruby.txt
Written /home/you/novel_narou.txt
Written /home/you/novel_kakuyomu.txt
Written /home/you/novel_aozora.txt
```

(`txt-all` prints one line per file, six lines total.) See [Full syntax reference: TXT export flavors](/syntax/reference/#txt-export-flavors) for exactly how each MDI construct maps in each flavor.

## Using an export profile

```bash
mdi build novel.mdi --to pdf --config novel.export.json -o dist/novel.pdf
```

`--config` currently affects PDF page geometry/fonts and the text formats' indentation; EPUB and DOCX intentionally use only front-matter metadata today (see [Export profiles](/ecosystem/export-profiles/) for the exact per-format support table). Passing `--config` with a format that doesn't yet consume it is not an error — the profile is simply not applied to that output.

## Error handling and exit codes

The CLI never prints a stack trace. On any failure it writes **one line** to stderr and exits with status `1`:

```bash
mdi build missing.mdi --to html
echo "exit code: $?"
```

```text
ENOENT: no such file or directory, open 'missing.mdi'
exit code: 1
```

```bash
mdi build novel.mdi --to svg
```

```text
Usage: mdi build <input.mdi> --to html|pdf|epub|docx|txt|txt-ruby|narou|kakuyomu|aozora|txt-all [--config export.json] [-o <output>]
```

```bash
mdi build novel.mdi --to txt-all -o out.txt
```

```text
--to txt-all does not accept -o; it writes all text formats next to the input file
```

An unrecognized `--to` value, a missing required flag, or any other malformed argument list all print the usage line above rather than attempting a best-effort guess. On success, exit status is `0` and stdout gets one `Written <path>` line per file produced.

## Current implementation status

Every format above is real, backed directly by the Rust functions listed in the table — none of it goes through a separate JavaScript renderer or a `remark`/`micromark` parsing pass anymore. What's still limited: EPUB/DOCX don't yet apply export-profile settings beyond front matter (see [Rust Core API status](/core/rust-api/#not-yet-implemented)), and PDF generation requires a Chromium-family browser to already be installed on the machine running the CLI — see [Rendering model](/core/rendering/#the-chromiumpdf-boundary) for the exact search path and the error you get if none is found.

## What this binding doesn't do

- **No watch mode, no server, no interactive editor.** `mdi build` runs once and exits.
- **No batch/glob input.** One `<input.mdi>` per invocation; script a loop in your shell if you need to convert many files.
- **No syntax authority of its own.** The CLI has never had, and does not have today, an independent MDI tokenizer — if a conversion looks wrong, the bug is in `mdi-core` or in the specific renderer function, not in argument parsing.

## Next steps

- [Export profiles](/ecosystem/export-profiles/) — the full `--config` schema.
- [Rendering model](/core/rendering/) — what each format's renderer actually produces.
- [Bindings: JavaScript / TypeScript](/bindings/javascript/) — calling the same functions from code instead of a shell.
