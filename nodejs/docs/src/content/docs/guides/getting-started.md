---
title: Getting Started
description: Parse a complete MDI document with Rust and render it to HTML, PDF, EPUB, DOCX, or plain text.
---

MDI is a Markdown dialect for Japanese novel typesetting. Its parser and
renderers live in Rust; the CLI and JavaScript package are interfaces to the
same `mdi-core` engine.

This toolchain implements **MDI 2.0**, whose normative human-readable
definition is the
[`SYNTAX.md` specification](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md).

## Command line

Install the CLI:

```bash
npm install --global @illusions-lab/mdi-cli
```

Then build any supported output from the same `.mdi` source:

```bash
mdi build novel.mdi --to html
mdi build novel.mdi --to pdf
mdi build novel.mdi --to epub -o dist/novel.epub
mdi build novel.mdi --to docx
mdi build novel.mdi --to txt
mdi build novel.mdi --to txt-ruby
mdi build novel.mdi --to narou
mdi build novel.mdi --to kakuyomu
mdi build novel.mdi --to aozora
mdi build novel.mdi --to txt-all
```

Without `-o`, output is written beside the input using the output format's
extension (`novel.mdi` becomes `novel.pdf`, for example).

`txt` emits basic plain text, while `txt-ruby` retains ruby as
`{base|reading}`. `narou`, `kakuyomu`, and `aozora` target their respective
Japanese publishing notations. `txt-all` writes all text variants without
overwriting one with another.

:::note
PDF layout is performed by Chromium, but Rust owns the operation end to end.
It renders HTML and print CSS, starts an isolated Chromium process, calls
`printToPDF` over the Chrome DevTools Protocol, and returns the PDF bytes.
Chromium never parses MDI or decides document semantics.
:::

## JavaScript

Install the primary package:

```bash
npm install @illusions-lab/mdi
```

Pass the complete source document to `parse`:

```js
import { readFile } from 'node:fs/promises';
import { parse } from '@illusions-lab/mdi';

const source = await readFile('novel.mdi', 'utf8');
const result = parse(source);

console.log(result.syntaxVersion);
console.log(result.irVersion);
console.log(result.document);
console.log(result.diagnostics);
```

`mdi-core` parses front matter, CommonMark, GFM, and MDI extensions together.
JavaScript does not pre-tokenize the source or run a separate Markdown parser.
Every source-backed node has a half-open UTF-8 byte span, and recoverable
problems are reported as diagnostics with stable codes and source spans.

Ordinary malformed syntax returns a usable document plus diagnostics. Reserve
`try`/`catch` for programming errors and unavailable system resources.

## Render the document

Parse once and pass the returned document to any renderer:

```js
import {
  parse,
  renderHtml,
  renderText,
  renderEpub,
  renderDocx,
  renderPdf,
} from '@illusions-lab/mdi';

const { document, diagnostics } = parse(source);

const html = renderHtml(document);
const text = renderText(document, 'plain');
const epub = renderEpub(document);
const docx = renderDocx(document);
const pdf = await renderPdf(document);
```

HTML and text return strings. EPUB, DOCX, and PDF return byte arrays. Export
profiles can be supplied to the renderer calls to select metadata, typography,
page geometry, fonts, and format-specific options.

All deterministic rendering semantics are implemented in Rust. PDF is the one
format that additionally needs an available Chromium executable. Browser
WebAssembly cannot launch Chromium, so browser applications request PDF from a
server or desktop host running the same Rust API.

## Front matter

An `.mdi` document can begin with YAML front matter:

```yaml
---
mdi: "2.0"
title: 吾輩は猫である
author: 夏目漱石
lang: ja
writing-mode: vertical
page-progression: rtl
---
```

Parsed front matter is part of the versioned document IR. Key order and
unknown keys are preserved. Renderers use the normalized metadata for such
things as the HTML title and language, EPUB package metadata, DOCX document
properties, writing direction, and page progression.

## Remark and unified

Remark is optional. Use it only when an application needs existing unified
plugins. `@illusions-lab/mdi-remark` converts between the Rust document IR and
mdast; it is not an MDI parser.

```js
import { parse, renderHtml } from '@illusions-lab/mdi';
import { toMdast, fromMdast } from '@illusions-lab/mdi-remark';

const parsed = parse(source);
const tree = toMdast(parsed.document);

// Run unified plugins over `tree` here.

const converted = fromMdast(tree);
const html = renderHtml(converted.document);
```

The adapter contains no tokenizer, grammar rules, or syntax fallback. When an
mdast tree is converted back, Rust validates it and creates the document IR
used by serializers and renderers.

See [Architecture](/guides/architecture/) for the complete ownership and
wire-contract rules.
