---
title: Document IR
description: The exact, versioned tree every MDI renderer and binding consumes — every node type, with real JSON.
---

**Prerequisites:** [Core concepts](/learn/core-concepts/#2-the-document-ir-intermediate-representation).

## The envelope

`parse()` (any binding) returns this shape. `irVersion` is currently `"1.0"`; `syntaxVersion` is currently `"2.0"` — they are independent numbers, see [Core concepts](/learn/core-concepts/#2-the-document-ir-intermediate-representation) for why.

```json
{
  "irVersion": "1.0",
  "syntaxVersion": "2.0",
  "capabilities": { "mdi": true, "commonMark": true, "gfm": true, "frontMatter": true, "sourceSpans": true },
  "document": { "span": { "startByte": 0, "endByte": 0 }, "children": [] },
  "diagnostics": []
}
```

Every capability is currently `true` — `mdi-core` parses the complete document (CommonMark, GFM, front matter, and MDI) in one pass, and every node carries a source span. Check `capabilities` in your own code anyway rather than hardcoding this assumption: the field exists precisely so a consumer never has to guess, and an older or future parse result could legitimately have some of these `false`.

## `Document`

```ts
interface MdiDocument {
  span: MdiSourceSpan;
  frontmatter?: MdiFrontmatter;
  children: MdiNode[];
}
```

`frontmatter` is a **sibling** of `children`, not a node inside it — front matter is document metadata, not document content, so it doesn't appear when you iterate `children` to walk the visible document.

```ts
interface MdiFrontmatter {
  span: MdiSourceSpan;
  raw: string;             // the YAML block's exact source text
  entries: Array<{ key: string; value: unknown }>;  // order-preserving, unknown keys included
}
```

## `MdiNode` catalogue

Every node has `type` and (for source-backed nodes) `span`. Container nodes have `children`.

**Ordinary Markdown nodes** (CommonMark/GFM, unmodified by MDI): `paragraph`, `heading` (`depth: 1–6`), `blockquote`, `list`/`listItem` (`ordered`, `start`), `code` (`value`, optional `lang`), `inlineCode`, `thematicBreak`, `html`, `table`/`tableRow`/`tableCell`, `link` (`url`, optional `title`), `image` (`url`, `alt`), `emphasis`, `strong`, `delete`, `text` (`value`), `footnoteReference` (`identifier`, `label`), `footnoteDefinition`.

**MDI nodes:**

| `type` | Extra fields | Produced by |
| --- | --- | --- |
| `ruby` | `base: string`, `ruby: MdiRubyReading` | `{base\|reading}` |
| `tcy` | `value: string` | `^text^` |
| `break` | — | `[[br]]` |
| `em` | `mark: string`, `children` | `[[em:text]]`, `[[em:<mark>:text]]`, `《《text》》` |
| `noBreak` | `children` | `[[no-break:text]]` |
| `warichu` | `children` | `[[warichu:text]]` |
| `kern` | `amount: string`, `children` | `[[kern:<amount>:text]]` |
| `blank` | — | a lone `\` line, `<br>`, or `[[blank]]` |
| `pagebreak` | `variant: "left" \| "right" \| null` | `[[pagebreak]]`, `[[pagebreak:left\|right]]` |
| `paragraph` with `indent` or `bottom` | `indent?: number`, `bottom?: number` | `[[indent:N]]` / `[[bottom]]` / `[[bottom:N]]` applied to the following paragraph |

```ts
type MdiRubyReading =
  | { type: "group"; value: string }
  | { type: "split"; value: string[] };
```

A worked example — `{雪女|ゆき.おんな}`:

```json
{
  "type": "ruby",
  "base": "雪女",
  "ruby": { "type": "split", "value": ["ゆき", "おんな"] },
  "span": { "startByte": 0, "endByte": 12 }
}
```

## Spans

`span.startByte`/`span.endByte` are a half-open UTF-8 **byte** range into the exact source string passed to `parse()`. See [Diagnostics and UTF-8 source spans](/core/diagnostics/) for the reasoning and for how to convert them into a host language's native string-index type.

## The transitional `MdiSyntaxDocument` shape

There is a **second, older, and much simpler** tree shape, produced only by the deprecated `parse_mdi_syntax` / `parseMdiSyntax` compatibility path:

```ts
interface MdiSyntaxDocument {
  blocks: Array<
    | { type: "paragraph"; inlines: MdiInline[]; indent: number | null; bottom: number | null }
    | { type: "blank" }
    | { type: "pagebreak"; variant: "left" | "right" | null }
  >;
}
```

This shape has **no spans, no front matter, and no ordinary Markdown nodes** — it only ever recognized MDI-specific inline/block constructs, treating everything else as opaque paragraph text. It predates the complete CommonMark/GFM/MDI parser and exists today purely so old callers don't break; new code should always use the `Document` shape above, returned by `parse()`/`parse_document()`. Do not confuse the two when reading source or writing an integration — a function returning `MdiSyntaxDocument` is a signal you're on the deprecated path.

## Next steps

- [Diagnostics and UTF-8 source spans](/core/diagnostics/)
- [Rust Core API status](/core/rust-api/) — which functions return which shape.
- [Full syntax reference](/syntax/reference/) — the IR snippet for every individual construct.
