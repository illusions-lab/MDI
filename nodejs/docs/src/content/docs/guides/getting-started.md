---
title: Getting Started
description: Install the MDI Node.js packages, parse a .mdi file, and convert it to HTML, PDF, EPUB, DOCX, or plain text.
---

This is a family of Node.js packages for **illusion Markdown (MDI)** — a Markdown
dialect for Japanese novel typesetting. This page walks through the two ways to
use it: the CLI and the programmatic API.

This toolchain targets **MDI 2.0**
([specification](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md)).

## The fast path: CLI

```bash
npm install --global @illusions-lab/mdi-cli
```

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

Without `-o`, the output file is written next to the input with the format's
extension (`novel.mdi` → `novel.pdf`).

`txt` writes basic plain text; `txt-ruby` keeps ruby as `{base|reading}`.
`narou`, `kakuyomu`, and `aozora` target their respective Japanese publishing
notations. `txt-all` writes all five text variants beside the input without
overwriting them.

:::note
PDF output renders through a headless Chromium via
[Playwright](https://playwright.dev) — that is what makes `vertical-rl`,
`text-combine-upright`, and `text-emphasis` come out correctly. On first use
you may need to install the browser once: `npx playwright install chromium`.
:::

## The programmatic path

Parse with `@illusions-lab/mdi-remark` (one plugin bundling GFM, YAML front
matter, and the MDI extensions), then hand the tree to any converter:

```bash
npm install unified remark-parse @illusions-lab/mdi-remark @illusions-lab/mdi-to-html
```

```js
import { readFile } from 'node:fs/promises';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdi from '@illusions-lab/mdi-remark';
import { mdiToHtml } from '@illusions-lab/mdi-to-html';

const source = await readFile('novel.mdi', 'utf8');
const processor = unified().use(remarkParse).use(remarkMdi);
const tree = await processor.run(processor.parse(source));

const html = mdiToHtml(tree); // complete HTML document, stylesheet inlined
```

The other converters have the same shape and are picked per output format:

```js
import { mdiToPdf } from '@illusions-lab/mdi-to-pdf';   // Promise<Buffer>
import { mdiToEpub } from '@illusions-lab/mdi-to-epub'; // Promise<Buffer>
import { mdiToDocx } from '@illusions-lab/mdi-to-docx'; // Promise<Buffer>
```

All four consume the **same mdast tree** — parse once, convert to any format.

## Front matter

A `.mdi` file can open with YAML front matter; `remarkMdi` resolves it (with
spec defaults) onto `tree.data.frontmatter`:

```yaml
---
mdi: "2.0"
title: 吾輩は猫である
author: 夏目漱石
lang: ja
writing-mode: vertical # or horizontal (default)
page-progression: rtl  # defaults follow writing-mode
---
```

Converters read it for document metadata: HTML gets `<title>`, `lang`, and
vertical `writing-mode`; EPUB gets OPF metadata; DOCX gets document properties
and vertical section layout.

## Integrating with an existing remark/rehype pipeline

If you already have a unified pipeline (this docs site is one), you don't need
the converters — register the syntax extensions and the hast handlers directly:

```js
import { mdi } from 'micromark-extension-mdi';
import { mdiFromMarkdown } from 'mdast-util-mdi';
import { mdiHandlers } from '@illusions-lab/mdi-to-hast';

function remarkMdiSyntax() {
	const data = this.data();
	(data.micromarkExtensions ??= []).push(mdi());
	(data.fromMarkdownExtensions ??= []).push(mdiFromMarkdown());
}
```

Then pass `remarkMdiSyntax` as a remark plugin and `mdiHandlers` as
`remark-rehype` handlers, and include the stylesheet
(`@illusions-lab/mdi-to-hast/mdi.css` or the exported `MDI_STYLESHEET`
string). See [Architecture](/MDI/guides/architecture/) for how the packages
fit together.
