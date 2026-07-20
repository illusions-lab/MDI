---
title: Migration and compatibility
description: Every place the current implementation and SYNTAX.md diverge, tracked explicitly — plus how to move off deprecated APIs.
---

**Prerequisites:** none beyond general familiarity with the site; this page is a reference you'll be linked to from wherever a gap is relevant.

MDI 2.0 syntax is specified in exactly one place: [`SYNTAX.md`](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md). Package versions use the `2.0.x` line for releases implementing that specification (see the repository [README](https://github.com/illusions-lab/MDI/blob/main/README.md#releases) for the exact versioning scheme). This page exists so that whenever the shipped implementation doesn't yet fully match the spec, that gap is written down in one place instead of discovered by surprise — per MDI's own rule: never silently pick a side, always say which is normative and which is current behavior.

## Stylesheet parity

`SYNTAX.md` specifies exact CSS for every MDI construct. `@illusions-lab/mdi-to-hast`'s stylesheet (used by this documentation site itself, and by anything using the `to-hast`/`to-html` adapter path) matches it precisely. `mdi-core`'s own embedded stylesheet — the one baked directly into `render_html`'s output, which is what the CLI's `--to html` and every direct `renderHtml()` call actually ship — currently differs in three places:

| Selector | `SYNTAX.md` / `mdi-to-hast` | `mdi-core`'s `render_html` | Practical effect |
| --- | --- | --- | --- |
| `.mdi-em` | `text-emphasis: var(--mdi-em, "﹅")` + `-webkit-text-emphasis` + `text-emphasis-position: over right` + `.mdi-em rt { text-emphasis: none; }` | `text-emphasis: var(--mdi-em, filled sesame)`, no position rule, no `rt` suppression, no `-webkit-` prefix | The custom `<mark>` character still renders (both use the same `--mdi-em` CSS variable and the same `<span class="mdi-em" style="--mdi-em:...">` markup), but without an explicit `text-emphasis-position`, placement follows the browser default instead of MDI's documented "over" (horizontal) / "right" (vertical) rule, and boten wrapping ruby may double marks onto the `<rt>` reading text. |
| `.mdi-warichu` | `display: inline-block; font-size: 0.5em; line-height: 1.1; max-inline-size: 10em; vertical-align: middle; text-align: start;` (two-line wrap approximation) | `font-size: .6em` only | The note renders smaller inline, but without the two-line wrap the spec's CSS approximates. |
| `.mdi-blank` | `min-block-size: 1lh` (logical property) | `min-height: 1em` (physical property) | Matches in horizontal writing; in vertical writing, `min-height` does not correspond to the inline space a blank paragraph is meant to reserve. |

In every case the **HTML element structure and class names are identical** — this is purely a difference in the accompanying CSS, and only matters if you rely on `render_html`'s embedded `<style>` block instead of supplying `@illusions-lab/mdi-to-hast`'s CSS (or your own spec-matching CSS) yourself. If you need exact spec-parity styling today, use `mdi-to-hast`'s stylesheet; if this gap has closed since this page was written, [`mdi-core/src/lib.rs`](https://github.com/illusions-lab/MDI/blob/main/mdi-core/src/lib.rs)'s `MDI_STYLESHEET` constant is the source of truth to check.

## Deprecated APIs and their replacements

| Deprecated | Use instead | Why |
| --- | --- | --- |
| `parseMdiSyntax` (JavaScript) | `parse` | Same function today (`parseMdiSyntax` is a direct alias) — the name exists only for callers migrating from before the JS package had a full-document `parse`. |
| `parse_mdi_syntax` (Rust) | `parse_document` / `parse_output` | Returns the older `MdiSyntaxDocument` shape — see [Document IR: the transitional `MdiSyntaxDocument` shape](/core/document-ir/#the-transitional-mdisyntaxdocument-shape) for exactly what's missing from it (no spans, no front matter, no ordinary Markdown nodes). |

## IR version handling

Treat `irVersion` as a wire-protocol version, not a cosmetic string — reject a version your code doesn't recognize rather than guessing at its shape. `@illusions-lab/mdi`'s own `parse()` already does this (`throw new Error('Unsupported MDI IR version: ...')`); replicate the same check in any new integration you write directly against the JSON wire format.

## Byte spans, not character indexes

Every span in the IR is a UTF-8 byte offset. Do not reinterpret it as a host-language character index without an explicit conversion — see [Diagnostics and UTF-8 source spans](/core/diagnostics/#spans-precisely) for the exact JavaScript conversion helper, [Bindings: Python](/bindings/python/#ir-version-and-utf-8-byte-spans) for the Python equivalent, and the same caution applies to any future Swift binding.

## Remark adapter: one-way today

`@illusions-lab/mdi-remark` parses real Rust output into `mdast`, but round-tripping an edited `mdast` tree back to `.mdi` text does not yet apply Rust's own recommended-form normalization (the same normalization `serializeMdi()` performs, like converting a `《《...》》` alias to `[[em:...]]`). See [Ecosystem: Remark / mdast adapter](/ecosystem/remark/#current-implementation-status-one-way-today) for detail.

## Documentation build note

This documentation site's own Markdown/MDI examples are rendered through `@illusions-lab/mdi-remark` (see `astro.config.mjs`) — the same Rust-backed adapter described above, not a separate documentation-only parser. If an example on this site ever renders differently than the same source would through the CLI or the JavaScript package directly, that's a bug to report, not an intentional site-specific behavior.

## Next steps

- [Rust Core API status](/core/rust-api/#not-yet-implemented) — the authoritative, function-level list of what doesn't exist yet.
- [Full syntax reference](/syntax/reference/) — each construct's own "Current implementation status" callout, where one applies.
