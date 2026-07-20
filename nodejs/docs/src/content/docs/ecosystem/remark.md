---
title: Remark / mdast adapter
description: How @illusions-lab/mdi-remark maps Rust's IR into mdast — and exactly what it doesn't do.
---

**Prerequisites:** [Document IR](/core/document-ir/), [Rust-authoritative architecture](/core/architecture/).

## Remark is an adapter, not a parser

`@illusions-lab/mdi-remark` lets an existing [unified](https://unifiedjs.com)/`remark` pipeline (an Astro site, a `remark`-based linter, a static-site generator) consume MDI documents as ordinary `mdast` trees, without giving `remark` any authority over what MDI syntax means. Concretely, and this is the entire point of this page: **it does not register a micromark tokenizer for MDI.** Reading its ~35-line source confirms exactly what it does:

```ts
export default function remarkMdi(this: Processor): void {
	const data = this.data();
	(data.toMarkdownExtensions ??= []).push(mdiToMarkdown());
	this.use(remarkGfm);
	this.use(remarkFrontmatter, ["yaml"]);
	(this as unknown as { parser: (source: string) => Root }).parser = (source) => {
		const tree = toMdast(parse(source).document);
		resolveFrontmatter(tree);
		return tree;
	};
}
```

It **replaces `Parser` entirely** with a function that calls the real Rust `parse()` from `@illusions-lab/mdi` and reshapes the result into `mdast`. `remark-gfm` and `remark-frontmatter` are used only for their `mdast`→Markdown **stringify** handlers (needed for round-tripping back to text); their own *parsing* hooks are registered but never reached, because this adapter's `parser` function runs instead of `remark`'s normal parse phase.

```text
complete .mdi source
        │
        ▼
   @illusions-lab/mdi  parse()  ── the same Rust call every other binding makes
        │
        ▼
  Rust document IR  ──▶  toMdast()  ──▶  mdast tree  ──▶  your unified plugins
```

## Minimal executable example

```ts
import { unified } from "unified";
import remarkMdi from "@illusions-lab/mdi-remark";
import remarkStringify from "remark-stringify";

const processor = unified().use(remarkMdi).use(remarkStringify);
const tree = processor.parse("{雪女|ゆき.おんな}が現れた。");

console.log(tree.children[0].children[0]);
// { type: "mdiRuby", base: "雪女", ruby: ["ゆき", "おんな"], data: {...} }
```

## Node type mapping

MDI's own node types get an `mdi`-prefixed `mdast` type so they don't collide with any existing `mdast` convention:

| Rust IR `type` | `mdast` type |
| --- | --- |
| `ruby` | `mdiRuby` (`ruby` field is unwrapped to a plain string or string array, dropping the `{type, value}` wrapper) |
| `tcy` | `mdiTcy` |
| `break` | `mdiBreak` |
| `em` | `mdiEm` |
| `noBreak` | `mdiNoBreak` |
| `warichu` | `mdiWarichu` |
| `kern` | `mdiKern` |
| `blank` | `mdiBlank` |
| `pagebreak` | `mdiPagebreak` (a `null` variant is dropped entirely rather than kept as `variant: null`) |
| `paragraph` with `indent`/`bottom` | ordinary `paragraph`, with `indent`/`bottom` moved into `data.mdiIndent`/`data.mdiBottom` — `mdast`'s convention is that renderer-specific fields live under `data`, not as top-level node properties |

Every other node (`heading`, `list`, `link`, `text`, GFM tables, footnotes, ...) passes through unchanged, because it was already a standard `mdast` shape coming out of Rust.

## Front matter as structured data

`resolveFrontmatter` parses the raw YAML block into `tree.data.frontmatter`, with real defaults filled in — not just the raw string:

```ts
interface MdiFrontmatter {
  mdi: string;                              // defaults to "2.0"
  title?: string;
  author?: string;
  lang: string;                             // defaults to "ja"
  date?: string;
  writingMode: "horizontal" | "vertical";   // defaults to "horizontal"
  pageProgression: "ltr" | "rtl";           // defaults to "rtl" when writingMode is "vertical", else "ltr"
}
```

Malformed YAML degrades to all-defaults rather than throwing — this adapter never fails a `unified` pipeline over front-matter syntax errors; Rust's own `mdi.version.unsupported` diagnostic (see [Diagnostics](/core/diagnostics/)) is the one place a version problem is actually reported, and it isn't surfaced through this adapter today.

## Current implementation status: one-way today

Parsing (`.mdi` source → `mdast`) is fully Rust-backed and real. **Serializing back** (an edited `mdast` tree → canonical `.mdi` text) is also implemented, via `mdiToMarkdown()` — but it operates on the `mdast` shapes above directly; it is not yet wired through Rust's own `serialize_mdi` normalization (see [Rust Core API status](/core/rust-api/)), so an edited-and-restringified document is not guaranteed to apply MDI's recommended-form normalization (e.g. automatically converting a `《《...》》` alias someone typed into `[[em:...]]`) the way `serializeMdi()` from `@illusions-lab/mdi` does.

## What this adapter doesn't do

- **It is not required.** `@illusions-lab/mdi`'s `parse()`/`renderHtml()` etc. work standalone; use this adapter only if you already have unified plugins that expect `mdast`.
- **It has no MDI grammar of its own** — if `remarkMdi` and `@illusions-lab/mdi`'s `parse()` ever produced different trees for the same input, that would be a bug in the `toMdast()` mapping function, not a second parser to fix.
- **It does not normalize on stringify** the way Rust's `serialize_mdi` does — see above.

## Next steps

- [Bindings: JavaScript / TypeScript](/bindings/javascript/) — the underlying `parse()`/`renderHtml()` this adapter calls.
- [Ecosystem: Migration and compatibility](/ecosystem/compatibility/) — the serializer-normalization gap tracked in context with other current gaps.
