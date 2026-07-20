---
title: Getting Started
description: Parse MDI with the current Rust-backed JavaScript surface and use the shipped CLI outputs.
---

MDI is a Markdown dialect for Japanese novel typesetting. `mdi-core` is the
syntax authority. The current JavaScript package exposes the Rust parse
surface, while the CLI and output packages still use the repository's
transitional TypeScript ecosystem path; see the [architecture status](/core/architecture/).

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
PDF layout is performed by Chromium in the current Node output package.
Chromium never parses MDI or decides document semantics. The Rust-native PDF
operation described by the architecture contract is not yet a public API in
the current crate.
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

The Rust parse surface returns a versioned IR and diagnostics. The Remark
adapter maps this Rust result to mdast; it does not register an MDI micromark
parser or decide MDI syntax.
Every source-backed node has a half-open UTF-8 byte span, and recoverable
problems are reported as diagnostics with stable codes and source spans.

Ordinary malformed syntax returns a usable document plus diagnostics. Reserve
`try`/`catch` for programming errors and unavailable system resources.

## Output status

`@illusions-lab/mdi` also provides Rust-backed `renderHtml(source)` and
`serializeMdi(source)`. Rust-native TXT, EPUB, DOCX, and PDF APIs remain
separate milestones; Chromium only performs PDF layout and never parses MDI.

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
plugins. The current `@illusions-lab/mdi-remark` package is the Node adapter
path; it is not an MDI parser authority. See [Remark / mdast adapter](/ecosystem/remark/).

```js
import { unified } from 'unified';
import remarkMdi from '@illusions-lab/mdi-remark';

// Register the adapter in a unified pipeline when mdast plugins are needed.
const processor = unified().use(remarkMdi);
```

The adapter is compatibility infrastructure. The Rust-authoritative whole
document contract and its migration status are documented in [Remark / mdast
adapter](/ecosystem/remark/).

See [Architecture](/guides/architecture/) for the complete ownership and
wire-contract rules.
