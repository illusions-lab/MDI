---
title: What is MDI?
description: MDI is Markdown for Japanese typography — one Rust grammar, rendered identically everywhere.
---

**Prerequisites:** none. This page assumes no prior MDI knowledge, but does assume you already know ordinary Markdown (`#` headings, `*emphasis*`, `[links](url)`).

## What is MDI?

MDI (**illusion Markdown**, file extension `.mdi`) is plain-text Markdown with a small set of extra notations for Japanese typography: **ruby** (振り仮名 reading glosses), **tate-chu-yoko** (縦中横, upright numerals in vertical text), **boten** (傍点, emphasis dots), **warichu** (割注, two-line inline notes), explicit line breaks, page breaks, block alignment, and vertical writing.

Every ordinary Markdown document is already a valid MDI document — MDI adds syntax, it does not remove or reinterpret anything from CommonMark or GFM. A `.mdi` file is a normal UTF-8 text file; nothing about its byte-level format differs from a `.md` file. The extension is a convention, not something the parser inspects.

```mdi
---
mdi: "2.0"
title: 雪女
lang: ja
writing-mode: vertical
---

# 第一章

{雪女|ゆきおんな}が現れたのは、第^12^話のことだった。
[[em:決して]]忘れない、と彼は思った。
```

If you deleted the front matter and the `{...}`/`^...^`/`[[em:...]]` notations from that example, it would still be a perfectly ordinary Markdown document. That's the whole design: **MDI is Markdown, plus typography extensions that fall back to being ignored or literal when something doesn't match.**

## Why MDI exists

Japanese fiction, especially light novels and web novels, relies on typographic devices that have no notation in CommonMark, GFM, or Pandoc Markdown:

- A word needs a **reading gloss** printed above or beside it (ruby), because the kanji alone is ambiguous or unfamiliar — `{東京|とうきょう}`.
- A handful of Arabic numerals inside vertical text need to sit **upright and horizontal**, not stacked one digit per line — `第^12^話`.
- A phrase needs **emphasis dots** next to each character, because Japanese typography does not use italics for emphasis — `[[em:それ]]`.
- A short aside needs to be set as a **two-line annotation** within the line, not a footnote — `[[warichu:注記]]`.
- The whole document may need to be typeset **vertically, right-to-left** (縦書き) instead of horizontally.

Existing tools solve pieces of this ad hoc: some publishing platforms (Kakuyomu, Narou) invented their own bracket notations; some editors bolt on custom Markdown extensions with no shared grammar. MDI's contribution is a **single specification** (`SYNTAX.md`) with **one executable implementation** (the `mdi-core` Rust crate), so the same `.mdi` file parses identically no matter which tool opens it — editor, CLI, web app, or publishing pipeline.

## MDI vs. plain Markdown

| | Plain Markdown (CommonMark/GFM) | MDI |
| --- | --- | --- |
| Headings, lists, links, tables, code fences, emphasis | Yes | Yes, unchanged |
| Front matter (`--- ... ---`) | Not part of CommonMark; tool-specific | Yes, with MDI-specific keys (`writing-mode`, `page-progression`) |
| Ruby, tate-chu-yoko, boten, warichu, kerning | No notation | Yes |
| Explicit line break vs. paragraph break | Only the fragile trailing-two-spaces hardbreak | `[[br]]` (unambiguous) vs. blank line |
| Vertical writing | No concept | A front-matter property, because it changes how several constructs render |
| Who decides what's valid syntax | Whatever library you used | One spec (`SYNTAX.md`), one implementation (`mdi-core`) |

A `.md` file with no MDI constructs and an `.mdi` file with no MDI constructs render identically. The difference only shows up once you use MDI-specific notation — and even then, invalid or ambiguous MDI notation is designed to **fall back to literal text** rather than corrupt the document (see each syntax page's "Common mistakes" section for the exact fallback rule).

## The complete pipeline, from source to output

This is the one flow every MDI tool follows, regardless of language:

```text
.mdi source (UTF-8 text)
        │
        ▼
   mdi-core (Rust)  ── parses CommonMark + GFM + front matter + MDI in one pass
        │
        ▼
versioned document IR  ── a tagged tree; every node has a UTF-8 byte span
        │
        ├──▶ renderHtml()        → HTML string
        ├──▶ renderText(format)  → TXT / narou / kakuyomu / aozora string
        ├──▶ renderEpub()        → EPUB 3 bytes
        ├──▶ renderDocx()        → DOCX bytes
        └──▶ renderHtml() + Chromium printToPDF → PDF bytes
```

Two things to notice:

1. **Parsing happens once, in Rust.** No renderer re-reads the original text or re-decides where a ruby span starts; every renderer consumes the same tree that `mdi-core` already built.
2. **PDF is HTML plus a print step.** Rust renders the same HTML/CSS it would give a browser, then asks a locally installed Chromium-family browser to lay that HTML out on paper and call `printToPDF`. Chromium never reads `.mdi` source and never makes a syntax decision — it only lays out HTML it's handed. See [Rendering model and the Chromium/PDF boundary](/core/rendering/) for the exact division of labor.

### Try it: source in, HTML out

This is the real, current `@illusions-lab/mdi` JavaScript API — every line below runs today:

```js
import { parse, renderHtml } from "@illusions-lab/mdi";

const source = "{雪女|ゆきおんな}が第^12^話に現れた。";

const { document, diagnostics } = parse(source);
console.log(diagnostics); // [] — nothing wrong with this source
console.log(document.children[0]); // the parsed paragraph node, MDI ruby/tcy included

console.log(renderHtml(source));
```

```html
<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><style>/* the .mdi-* stylesheet Rust ships alongside the markup */</style></head><body>
<p><ruby class="mdi-ruby">雪女<rp>（</rp><rt>ゆきおんな</rt><rp>）</rp></ruby>が第<span class="mdi-tcy">12</span>話に現れた。</p>
</body></html>
```

The `<rp>（</rp>`/`<rp>）</rp>` pair is a fallback for the rare browser or reader with no ruby support — it's hidden by CSS wherever ruby rendering works, and shown as plain parentheses where it doesn't.

The [Getting Started](/guides/getting-started/) page walks through installing the CLI and the JavaScript package and running this yourself.

## When should you reach for MDI?

- You're writing Japanese fiction (light novels, web novels, scripts) and need ruby, vertical writing, or emphasis dots in a plain-text, version-controllable source format.
- You want **one source file** to produce HTML (for a web reader), EPUB (for e-readers), DOCX (for a publisher), and plain text (for submission to a specific platform like Narou or Kakuyomu) without hand-editing each output.
- You want the guarantee that the same source parses the same way in your editor, your build pipeline, and your CLI — because all three call the same Rust code, not three different reimplementations.

## What MDI is *not*

- **Not a word processor or WYSIWYG format.** MDI is a source notation; DOCX/PDF output is a rendering of it, not the other way around.
- **Not a general-purpose typesetting language.** It covers the specific, named Japanese typographic devices in `SYNTAX.md` — it does not have a generic "any CSS property" escape hatch in the syntax itself.
- **Not implemented in every language yet.** Rust, JavaScript/TypeScript, and Python are real today (`pip install illusion-markdown`); Swift is still **Planned** — see [Bindings](/bindings/swift/) for its current status before assuming you can `import` it.

## Next steps

- [Core concepts](/learn/core-concepts/) — the vocabulary (IR, diagnostics, spans, capabilities) used by every other page on this site.
- [Getting Started](/guides/getting-started/) — install the CLI and JavaScript package and run your first conversion.
- [Full syntax reference](/syntax/reference/) — every MDI construct, one tutorial section each.
