---
title: Core concepts
description: The five ideas — grammar, IR, spans, diagnostics, capabilities — that every MDI interface shares.
---

**Prerequisites:** [What is MDI?](/learn/what-is-mdi/)

Every MDI interface — the Rust crate, the JavaScript package, the Python package, the CLI, and Swift — shares the same five ideas. Learn them once here; every later page on this site (and every binding's own docs) assumes you already know what these words mean.

## 1. One grammar, one implementation

`mdi-core` (Rust) is the only code that decides whether a piece of text is MDI syntax. It receives the **entire UTF-8 document** in one call — never a fragment — because MDI boundaries depend on surrounding Markdown context. The three lines below all contain the substring `^12^`, and only `mdi-core`, looking at the whole line, knows which ones are tate-chu-yoko:

```markdown
第^12^話                 ← tate-chu-yoko: renders "12" upright
`^12^`                   ← literal code span: ^12^ is inert here
**第^12^話**              ← tate-chu-yoko still applies inside strong emphasis
```

No other language or tool is allowed to reimplement this decision. A JavaScript, Python, or Swift package may call into Rust, cache the result, or reshape it into idiomatic types — but it may not contain its own copy of the ruby/tate-chu-yoko/boten grammar rules. This is what "Rust-authoritative" means concretely: if two tools ever disagreed about whether something is valid MDI, that would be a bug, because there is only supposed to be one grammar to disagree with.

## 2. The document IR (intermediate representation)

Parsing produces a **tree**, not styled output. This tree is called the IR, and it's the one artifact every renderer consumes. Calling `parse()` on a tiny document returns something shaped like this:

```json
{
  "irVersion": "1.0",
  "syntaxVersion": "2.0",
  "capabilities": { "mdi": true, "commonMark": true, "gfm": true, "frontMatter": true, "sourceSpans": true },
  "document": {
    "span": { "startByte": 0, "endByte": 21 },
    "children": [
      {
        "type": "paragraph",
        "span": { "startByte": 0, "endByte": 21 },
        "children": [
          { "type": "ruby", "base": "雪女", "ruby": { "type": "group", "value": "ゆきおんな" }, "span": { "startByte": 0, "endByte": 12 } }
        ]
      }
    ]
  },
  "diagnostics": []
}
```

A few things worth noticing:

- **It's versioned twice.** `syntaxVersion` ("2.0") is the MDI *language* version — which constructs exist and what they mean. `irVersion` ("1.0") is the *wire format* version — the JSON shape above. They change independently: a future MDI 2.1 syntax addition might ship with no IR change at all, while an IR-breaking refactor could happen without a syntax version bump.
- **It's one tree for CommonMark, GFM, and MDI together.** There's no separate "Markdown tree" and "MDI tree" that get merged — headings, links, tables, and ruby nodes are siblings and children in the same structure, because MDI syntax can nest inside Markdown (and vice versa; see [Inline nesting](/syntax/reference/#inline-nesting)).
- **Every source-backed node carries a `span`.** That's the next concept.

Read [Document IR](/core/document-ir/) for the full node catalogue.

## 3. Spans are UTF-8 byte offsets, not character indexes

`span.startByte` / `span.endByte` are a half-open range (`startByte` inclusive, `endByte` exclusive) measured in **UTF-8 bytes** of the original source string — not Unicode code points, not UTF-16 code units, and not grapheme clusters.

This matters concretely: `雪` is one character but three UTF-8 bytes. If you're in a JavaScript environment (where strings are UTF-16) and you want to highlight a span in a `<textarea>`, you cannot use the byte offset as a string index directly — you need to convert. The reason MDI uses byte offsets rather than a host language's native string-index type is that byte offsets are the one representation every language can compute from without ambiguity; a "character index" is not a well-defined concept until you pick a definition (UTF-16 units? code points? grapheme clusters?), and MDI does not want to bake a JavaScript-specific or Python-specific choice into the wire format.

## 4. Diagnostics are data, not exceptions

A **diagnostic** reports a recoverable problem — it is a plain object in the `diagnostics` array, never a thrown error:

```json
{ "severity": "warning", "code": "mdi.version.unsupported", "message": "MDI 2.1 is newer than the supported 2.0", "span": { "startByte": 0, "endByte": 34 } }
```

`parse()` almost never throws. Malformed or ambiguous MDI syntax (an unmatched `^`, a `[[kern:` with an invalid amount, mismatched ruby dot segments) is handled by the **literal-fallback rule** documented on each syntax page — the text is kept as-is in the tree, usually without even a diagnostic, because it's the same tolerant behavior Markdown itself has for unrecognized syntax. Exceptions are reserved for things a diagnostic can't describe: a non-string argument, or a native resource failure (e.g., no Chromium executable for PDF). See [Diagnostics and UTF-8 source spans](/core/diagnostics/) for the complete current list of diagnostic codes (today, exactly one).

## 5. Capabilities describe *this* parse, not a promise about the future

`capabilities` is a set of booleans (`mdi`, `commonMark`, `gfm`, `frontMatter`, `sourceSpans`) attached to every parse result. Check it instead of assuming a feature is present — this is what let earlier, transitional versions of the JavaScript binding tell callers "I only parsed MDI-specific constructs, not full CommonMark" before the Rust core grew a complete parser. Today every capability is `true`; the field still exists because the IR is explicitly versioned and bindings must not guess.

## Presentation is a separate layer

Everything above describes **meaning** — what the source says. A separate, later step decides **appearance**: page size, font, margins, writing mode for a specific export, indentation style. That's an [export profile](/ecosystem/export-profiles/), and it is deliberately incapable of changing what a document *is* — only how a renderer lays it out. Renderers (`renderHtml`, `renderText`, `renderEpub`, `renderDocx`, and the PDF path through Chromium) consume the IR and a profile; see [Rendering model and the Chromium/PDF boundary](/core/rendering/) for exactly where Chromium's job starts and stops.

## Next steps

- [Document IR](/core/document-ir/) — every node type, in detail.
- [Diagnostics and UTF-8 source spans](/core/diagnostics/) — the full diagnostic-code table.
- [Getting Started](/guides/getting-started/) — put these concepts to use with the real CLI and JavaScript API.
