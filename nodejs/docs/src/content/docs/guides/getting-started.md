---
title: Getting Started
description: Install the CLI and the JavaScript package, then convert a real .mdi file to HTML, PDF, and text.
---

**Prerequisites:** [What is MDI?](/learn/what-is-mdi/) and [Core concepts](/learn/core-concepts/) — this page assumes you already know what the IR, spans, and diagnostics are. You'll also need [Node.js](https://nodejs.org) 20 or later.

This page implements **MDI 2.0**, whose normative human-readable definition is [`SYNTAX.md`](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md). Every command and code sample below is copy-pasteable and runs against the packages actually published from this repository — nothing here is aspirational.

## 1. Write a `.mdi` file

Create `novel.mdi`:

```mdi
---
mdi: "2.0"
title: 雪女
author: 小泉八雲
lang: ja
writing-mode: vertical
---

# 第一章

{雪女|ゆき.おんな}が現れたのは、第^12^話のことだった。
彼は[[em:決して]]忘れないと誓った。[[br]]
その日は大安[[warichu:六曜の一つで吉日とされる]]であった。
```

## 2. Convert it with the CLI

Install the CLI globally:

```bash
npm install --global @illusions-lab/mdi-cli
```

Run it:

```bash
mdi build novel.mdi --to html
```

```text
Written /path/to/novel.html
```

The full command shape, taken directly from the CLI's own usage message:

```text
mdi build <input.mdi> --to html|pdf|epub|docx|txt|txt-ruby|narou|kakuyomu|aozora|txt-all [--config export.json] [-o <output>]
```

| Flag | Meaning |
| --- | --- |
| `--to <format>` | Required. One of the formats listed above. |
| `-o <path>` | Optional. Output path. Without it, output is written beside the input using the format's extension — `novel.mdi --to pdf` writes `novel.pdf`; `--to txt-ruby` writes `novel_ruby.txt` (the CLI names text variants `<stem>_<variant>.txt`, and plain `txt` has no suffix). |
| `--config <path>` | Optional. Path to an [export profile](/ecosystem/export-profiles/) JSON file controlling page size, fonts, margins, and text-indent settings. |

Try every output format:

```bash
mdi build novel.mdi --to html                          # novel.html
mdi build novel.mdi --to pdf                            # novel.pdf
mdi build novel.mdi --to epub -o dist/novel.epub        # dist/novel.epub
mdi build novel.mdi --to docx                           # novel.docx
mdi build novel.mdi --to txt                            # novel.txt      — ruby discarded
mdi build novel.mdi --to txt-ruby                       # novel_ruby.txt — ruby kept as {base|reading}
mdi build novel.mdi --to narou                          # novel_narou.txt   — 小説家になろう notation
mdi build novel.mdi --to kakuyomu                       # novel_kakuyomu.txt — カクヨム notation
mdi build novel.mdi --to aozora                         # novel_aozora.txt  — 青空文庫 notation, Shift_JIS-encoded
mdi build novel.mdi --to txt-all                        # writes all six text variants; rejects -o
```

`--to txt-all` and `-o` are mutually exclusive — using both is a usage error, because `txt-all` always writes multiple files next to the input.

### What actually happens on each format

- **HTML, TXT/`txt-ruby`/`narou`/`kakuyomu`/`aozora`, EPUB, and DOCX** are rendered **directly by the Rust core** (`renderHtml`, `renderTextFormat`, `renderEpub`, `renderDocx` in `@illusions-lab/mdi`) — the CLI does not reparse or reinterpret anything.
- **PDF** takes the same Rust-rendered HTML and hands it to a locally installed Chromium-family browser, which performs pagination and calls `printToPDF`. Chromium never receives `.mdi` source and makes no syntax decision. If no Chromium-family browser is found, the command fails with an error naming the missing dependency — see [Rendering model](/core/rendering/) for how to point it at a specific executable.
- **`aozora`** is encoded to **Shift_JIS** on write, matching what Aozora Bunko's own submission tooling expects; every other text variant is written as UTF-8.

### When something goes wrong

The CLI never throws a stack trace at you. Errors go to stderr as a single line, and the process exits with code `1`:

```bash
mdi build missing.mdi --to html
```

```text
ENOENT: no such file or directory, open 'missing.mdi'
```

```bash
mdi build novel.mdi --to svg
```

```text
Usage: mdi build <input.mdi> --to html|pdf|epub|docx|txt|txt-ruby|narou|kakuyomu|aozora|txt-all [--config export.json] [-o <output>]
```

An unrecognized `--to` value (or any other malformed argument list) prints the usage line above and exits `1` — it does not attempt a best-effort guess at what you meant.

## 3. Parse and render from JavaScript

If you're building an application rather than shelling out to the CLI, install the primary package:

```bash
npm install @illusions-lab/mdi
```

```js
import { readFile } from "node:fs/promises";
import { parse, renderHtml } from "@illusions-lab/mdi";

const source = await readFile("novel.mdi", "utf8");

const { document, diagnostics, syntaxVersion, irVersion } = parse(source);
console.log(syntaxVersion, irVersion); // "2.0" "1.0"
console.log(diagnostics);              // [] for this file — nothing to warn about
console.log(document.frontmatter.entries);
// [{ key: "mdi", value: "2.0" }, { key: "title", value: "雪女" }, ...]

const html = renderHtml(source);
```

`parse` never needs a host Markdown parser — CommonMark, GFM, front matter, and MDI are all decided inside the single `parse` call. Ordinary malformed syntax comes back as a usable document plus (usually empty) diagnostics; reserve `try`/`catch` for programming errors, such as passing a non-string:

```js
parse(42); // throws TypeError: source must be a string
```

See [Bindings: JavaScript / TypeScript](/bindings/javascript/) for every exported function (`renderEpub`, `renderDocx`, `renderText`, `renderTextFormat`, `serializeMdi`) with full signatures and examples.

## 4. Front matter, explained

The front matter block at the top of `novel.mdi` is ordinary YAML, parsed as part of the same `parse()` call:

```yaml
---
mdi: "2.0"
title: 雪女
author: 小泉八雲
lang: ja
writing-mode: vertical
---
```

- `mdi` declares the syntax version the document targets. Omit it and the parser assumes its own latest supported version. Declare a version *newer* than the parser supports, and you get a `mdi.version.unsupported` warning diagnostic — parsing still proceeds on a best-effort basis (see [Diagnostics](/core/diagnostics/)).
- `writing-mode: vertical` changes how `renderHtml` lays out the document (`writing-mode: vertical-rl` on the root element) and is why tate-chu-yoko and boten exist at all — they're vertical-writing typography devices that also degrade gracefully in horizontal writing.
- Key order and unknown keys are preserved in `document.frontmatter.entries`; renderers ignore keys they don't recognize rather than erroring.

## 5. Optional: plug into a `unified`/`remark` pipeline

Skip this section unless you already have a `unified` pipeline (e.g. Astro, a static-site generator, a `remark`-based linter) that expects `mdast` nodes. `@illusions-lab/mdi-remark` is an **adapter**, not a second parser — it calls the same Rust `parse()` and reshapes the result into `mdast`:

```js
import { unified } from "unified";
import remarkMdi from "@illusions-lab/mdi-remark";
import remarkStringify from "remark-stringify";

const processor = unified().use(remarkMdi).use(remarkStringify);
const tree = processor.parse(await readFile("novel.mdi", "utf8"));
```

Full detail, including exactly what does and doesn't round-trip, is in [Remark / mdast adapter](/ecosystem/remark/).

## Next steps

- [Full syntax reference](/syntax/reference/) — every construct used in `novel.mdi` above, explained one at a time.
- [Rust-authoritative architecture](/core/architecture/) — the ownership rules behind "one grammar, one implementation."
- [Export profiles](/ecosystem/export-profiles/) — control page size, fonts, and margins with `--config`.
