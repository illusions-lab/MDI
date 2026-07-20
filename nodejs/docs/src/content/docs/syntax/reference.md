---
title: Full syntax reference
description: Every MDI 2.0 construct — purpose, syntax, example, parsed IR, rendered output, and fallback rule.
---

**Prerequisites:** [What is MDI?](/learn/what-is-mdi/) and [Core concepts](/learn/core-concepts/).

The **normative** specification is [`SYNTAX.md`](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md) in the repository — every rule on this page is taken directly from it, and if the two ever disagree, `SYNTAX.md` wins and this page has a bug. This page exists to *teach* the same rules with worked examples, parsed IR, and rendered output for each construct, which a normative spec deliberately keeps terse.

Each section below follows the same shape: **purpose → syntax → minimal example → full document → parsed IR → rendered output → common mistakes → literal fallback → interaction with Markdown → vertical vs. horizontal**. Sections marked **Current implementation status** call out any place where the shipped renderer doesn't yet match what `SYNTAX.md` specifies — MDI tracks these explicitly instead of silently picking one or the other.

## Quick reference

| Feature | Recommended form | Meaning |
| --- | --- | --- |
| Front matter | YAML between `---` markers | Document metadata and writing mode |
| Ruby | `{base\|reading}` | Reading attached to a base string |
| Tate-chu-yoko | `^12^` | Short horizontal run inside vertical text |
| Boten | `[[em:text]]` | Emphasis dots; `[[em:<mark>:text]]` selects the mark |
| No-break | `[[no-break:text]]` | Keep a phrase from breaking mid-line |
| Line break | `[[br]]` | Explicit break inside a paragraph |
| Blank paragraph | `\` alone on a line | One intentional empty paragraph |
| Warichu | `[[warichu:text]]` | Two-line inline annotation |
| Kerning | `[[kern:-0.1em:text]]` | Explicit letter-spacing |
| Block alignment | `[[indent:N]]` / `[[bottom]]` / `[[bottom:N]]` | Indent, or align to line-end |
| Page break | `[[pagebreak]]` / `[[pagebreak:left\|right]]` | Force a page boundary |
| Footnotes | `[^id]` / `[^id]: text` (GFM) | Reference and define a note |
| Escapes | `\{` `\}` `\|` `\^` `\[` `\]` `\:` `\《` `\》` | Keep a delimiter literal |

## 1. Front matter

**Purpose.** Declares document-level properties — most importantly writing direction, which changes how several inline constructs render.

**Syntax.** A YAML block delimited by `---` lines at the very start of the file.

**Minimal example.**

```mdi
---
mdi: "2.0"
writing-mode: vertical
---
```

**Full document.**

```mdi
---
mdi: "2.0"
title: 雪女
author: 小泉八雲
lang: ja
writing-mode: vertical
page-progression: rtl
---

# 第一章
```

**Parsed IR.** Front matter is a sibling of `children`, not a node inside it, and preserves key order and unknown keys:

```json
{
  "frontmatter": {
    "span": { "startByte": 0, "endByte": 83 },
    "raw": "mdi: \"2.0\"\ntitle: 雪女\nauthor: 小泉八雲\nlang: ja\nwriting-mode: vertical\npage-progression: rtl",
    "entries": [
      { "key": "mdi", "value": "2.0" },
      { "key": "title", "value": "雪女" },
      { "key": "writing-mode", "value": "vertical" }
    ]
  }
}
```

**Rendering output.** `renderHtml` reads `lang`, `title`, and `writing-mode` from front matter: `<html lang="ja">`, a `<title>`, and — only when `writing-mode: vertical` — a `style="writing-mode: vertical-rl;"` on the `<html>` element. `writing-mode: horizontal` (the default) adds no style attribute at all; horizontal is simply the browser's own default, not an explicit MDI declaration.

**Common mistakes.**
- Forgetting the closing `---` — without it, the block is not front matter and is parsed as an ordinary Markdown thematic break followed by a paragraph.
- Assuming `mdi:` gates the document. A newer-than-supported version produces a *warning* diagnostic, not a parse failure — see [Diagnostics](/core/diagnostics/#mdiversionunsupported).

**Literal fallback.** Front matter only exists as the very first bytes of the file. The same `---`/YAML block appearing later, or with content before it, parses as ordinary Markdown (a thematic break, or a setext heading underline).

**Interaction with plain Markdown.** Front matter is not part of CommonMark; MDI treats it the way most static-site Markdown tooling already does, so existing `.md` files that already start with YAML front matter parse the same way once renamed to `.mdi`.

**Vertical vs. horizontal.** This is the single switch that decides writing direction for the *entire* document. There is no per-block override — if you need mixed layout, that's a job for [export profiles](/ecosystem/export-profiles/) applied per output, not for front matter.

## 2. Ruby (ルビ)

**Purpose.** Attaches a reading gloss to a base string — the standard way Japanese text glosses unfamiliar or ambiguous kanji.

**Syntax.** `{base|reading}`. A `.` inside the reading splits it across the base string's grapheme clusters (**split ruby**, aka mono ruby); no dot means the whole reading applies to the whole base as one unit (**group ruby**).

**Minimal example.** `{東京|とうきょう}` → group ruby. `{東京|とう.きょう}` → split ruby, 東→とう, 京→きょう.

**Full document.**

```mdi
私は{雪女|ゆき.おんな}を見た。
{彼女|かのじょ}は{微笑|ほほえ}んだ。
```

**Parsed IR.**

```json
{ "type": "ruby", "base": "雪女", "ruby": { "type": "split", "value": ["ゆき", "おんな"] }, "span": { "startByte": 3, "endByte": 15 } }
```

Group ruby uses `"type": "group"` with a single string `"value"` instead of an array.

**Rendering output.**

```html
<ruby class="mdi-ruby">雪<rp>（</rp><rt>ゆき</rt><rp>）</rp>女<rp>（</rp><rt>おんな</rt><rp>）</rp></ruby>
```

The `<rp>（</rp>`/`<rp>）</rp>` pair is a fallback for readers with no ruby support; CSS hides it wherever ruby rendering actually works.

**Common mistakes.**
- Writing `{東京|.きょう}` expecting split ruby: the dot-segment count (1, since there's one dot producing one non-empty and one empty segment — actually here there's a leading empty segment before the dot) doesn't match the 2-character base, so it silently falls back to **group ruby** with the dots stripped: `{東京|きょう}`'s group reading becomes `きょう` applied to all of 東京.
- A literal `|` inside ruby syntax inside a GFM **table cell** must be written `\|` — table parsing consumes `\|` at the block stage before MDI ever sees it, which is what makes `{東京\|とうきょう}` inside a cell produce ordinary ruby.
- Counting "characters" by JavaScript string length instead of grapheme clusters — `{𠮟る|しか.る}` is valid split ruby because 𠮟 is one *grapheme cluster* (it's a surrogate pair in UTF-16, but MDI counts UAX #29 extended grapheme clusters, not UTF-16 code units).

**Literal fallback.** Split ruby with a segment count that doesn't match the base's grapheme-cluster count, or containing an empty segment, becomes group ruby with dots removed — it never becomes plain unstyled text. A `{` with no matching bare `|` before an unescaped `}` (or no `}` on the same line) is not ruby at all and stays completely literal.

**Interaction with plain Markdown.** Both the base and the reading are **plain text** — no nested Markdown or MDI syntax is recognized inside `{...|...}`. Ruby syntax itself can appear inside Markdown emphasis, links, and other inline containers: `**{東京|とうきょう}**`.

**Vertical vs. horizontal.** The markup is identical in both directions; the browser's native vertical-text ruby layout (reading text to the right of the base column) requires no MDI-specific CSS.

## 3. Tate-chu-yoko (縦中横)

**Purpose.** Renders a short run of digits or Latin letters upright and horizontal within vertical text, instead of stacking each character on its own line.

**Syntax.** `^text^`, where `text` matches `[0-9A-Za-z!?]{1,6}` — halfwidth alphanumerics plus `!`/`?`, one to six characters.

**Minimal example.** `第^12^話` → 第, then "12" upright, then 話.

**Full document.**

```mdi
第^12^話。令和^7^年のことである。
```

**Parsed IR.**

```json
{ "type": "tcy", "value": "12", "span": { "startByte": 3, "endByte": 7 } }
```

**Rendering output.**

```html
<span class="mdi-tcy">12</span>
```

`.mdi-tcy { text-combine-upright: all; }` — this CSS property only has an effect inside `writing-mode: vertical-*`, so no conditional class is needed.

**Common mistakes.**
- Trying `^はい^` — CJK characters are outside the allowed charset by design (this mirrors real TCY usage, which is specifically for short digit/Latin runs); the carets stay literal.
- Writing `(^_^)` and expecting no interference — this is exactly why the charset excludes `_` and other symbols; it's inert here and stays literal text.
- Expecting `^text^` to be superscript, as Pandoc's Markdown extension defines it. In `.mdi` files it is always tate-chu-yoko; there is no superscript notation in MDI.

**Literal fallback.** Content that doesn't match the charset/length rule, or a `^` with no matching `^` on the same line, leaves both carets as literal characters.

**Interaction with plain Markdown.** `^...^` content is plain text — no nested syntax. Tate-chu-yoko can appear inside emphasis, links, and other MDI bracket macros (`[[no-break:第^12^話]]`).

**Vertical vs. horizontal.** This is the construct that most depends on writing direction: in horizontal writing, the `.mdi-tcy` span is emitted exactly the same but is visually inert (plain inline text), because `text-combine-upright` does nothing outside vertical writing. Switching a document's `writing-mode` therefore needs no reparse — the same markup already works for both.

## 4. Boten (傍点)

**Purpose.** Places emphasis marks alongside each character — Japanese typography's standard emphasis device, used where italics would be unnatural.

**Syntax.** Recommended: `[[em:text]]` (default mark) or `[[em:<mark>:text]]`, where `<mark>` is **any single grapheme cluster** that is not whitespace or a control character. Supported alternate: `《《text》》` (Kakuyomu notation, always the default mark).

**Minimal example.** `[[em:それ]]` → boten with the default mark ﹅ (ゴマ点). `[[em:●:決して]]` → boten with mark ●.

**Full document.**

```mdi
彼は[[em:それ]]を見た。
[[em:●:決して]]忘れない。
```

**Parsed IR.**

```json
{ "type": "em", "mark": "﹅", "children": [{ "type": "text", "value": "それ" }], "span": { "startByte": 2, "endByte": 12 } }
```

**Rendering output.**

```html
<span class="mdi-em" style="--mdi-em:&quot;﹅&quot;;">それ</span>
```

**Common mistakes.**
- Writing `[[em:dot]]` expecting `d` to be treated as a mark: the mark position only activates when the text before the *first* `:` is **exactly one character** *and* another `:` follows — `[[em:dot]]` has no second `:`, so the whole content ("dot") is the text, with the default mark.
- Writing `[[em:ab:cd]]`: `ab` is two characters, so it fails the one-character mark test — the whole content (`ab:cd`) becomes the text under the default mark, rather than an error.
- Nesting `《`/`》` inside the alias form, e.g. `《《雪》考》` — the content must not contain `《` or `》` at all, so this entire string is left as **plain literal text** (protecting nested CJK title quotes like 《雪》 from being misread as boten).
- Wanting a literal `:` inside `[[em:...]]` text — write `\:`.

**Literal fallback.** `《《...》》` containing `《`, `》`, or a line break is left completely literal, brackets included. `[[em:...]]` always parses as boten once the delimiters balance — there's no "invalid, fall back to plain text" case for the bracket form itself, only for the mark-parameter position.

**Interaction with plain Markdown.** The content of `[[em:...]]` is **MDI inline content** — ruby, tate-chu-yoko, and other bracket macros may appear inside it, e.g. `[[em:{東京|とうきょう}]]` puts emphasis dots on ruby-annotated text. `《《...》》` content, by contrast, is plain text with no nested syntax at all.

**Vertical vs. horizontal.** `text-emphasis-position: over right` places the marks above the text in horizontal writing and to the right of the text in vertical writing — the same declaration serves both, because CSS resolves "over"/"right" against the current writing mode.

:::caution[Current implementation status]
`SYNTAX.md` specifies `text-emphasis: var(--mdi-em, "﹅")` with `-webkit-text-emphasis` and an explicit `text-emphasis-position: over right`, plus `.mdi-em rt { text-emphasis: none; }` to stop marks from doubling onto ruby text nested inside boten. The `@illusions-lab/mdi-to-hast` package's stylesheet (used by this documentation site, and by any consumer of the HAST/`to-html` adapter path) matches this exactly. `mdi-core`'s own `renderHtml`/`render_html` — the function the CLI's `--to html` calls today — currently ships a smaller built-in stylesheet with `text-emphasis: var(--mdi-em, filled sesame)` and no `text-emphasis-position` or `.mdi-em rt` rule. The HTML *element structure* is identical either way (`<span class="mdi-em" style="--mdi-em:&quot;﹅&quot;;">`); only the accompanying CSS differs, and only if you rely on the Rust-embedded stylesheet instead of supplying `mdi-to-hast`'s CSS yourself. See [Ecosystem: Migration and compatibility](/ecosystem/compatibility/#stylesheet-parity).
:::

## 5. No-break (改行抑止)

**Purpose.** Prevents a line break from landing inside a proper noun or fixed phrase.

**Syntax.** `[[no-break:text]]`.

**Minimal example.** `[[no-break:東京都新宿区]]` stays on one line even if it would otherwise wrap.

**Full document.**

```mdi
[[no-break:東京都新宿区]]に住んでいます。
```

**Parsed IR.**

```json
{ "type": "noBreak", "children": [{ "type": "text", "value": "東京都新宿区" }], "span": { "startByte": 0, "endByte": 15 } }
```

**Rendering output.**

```html
<span class="mdi-nobr">東京都新宿区</span>
```

```css
.mdi-nobr { white-space: nowrap; word-break: keep-all; }
```

**Common mistakes.** `[[no-break:]]` with empty content is not recognized as no-break at all (the rule requires non-empty payload) — it's left as literal text, brackets and all.

**Literal fallback.** Empty content, or unbalanced `[[`/`]]`, leaves the whole macro as literal text.

**Interaction with plain Markdown.** Content is MDI inline content — ruby and tate-chu-yoko may appear inside, e.g. `[[no-break:第^12^話]]`.

**Vertical vs. horizontal.** No difference — `white-space: nowrap` behaves the same on both writing-mode axes.

## 6. Explicit line break (改行マーカー) and paragraph break (換段)

**Purpose.** MDI needs an unambiguous way to break a line *within* a paragraph, because CommonMark's own hardbreak (two trailing spaces) is invisible in a diff and easy to lose in copy-paste.

**Syntax.** `[[br]]` anywhere inside a paragraph forces a line break and stays in the same `<p>`. A **blank line** (ordinary CommonMark) starts a new paragraph — MDI does not introduce a separate paragraph-break notation.

**Minimal example.**

```mdi
春は曙。[[br]]
やうやう白くなりゆく山ぎは。
```

**Full document.**

```mdi
春は曙。[[br]]
やうやう白くなりゆく山ぎは、少し明かりて。

夏は夜。
```

**Parsed IR.**

```json
{ "type": "break", "span": { "startByte": 12, "endByte": 18 } }
```

The blank line between "春は曙。..." and "夏は夜。" produces two separate `paragraph` nodes as siblings — it has no node of its own.

**Rendering output.**

```html
<p>春は曙。<br class="mdi-break">やうやう白くなりゆく山ぎは、少し明かりて。</p>
<p>夏は夜。</p>
```

**Common mistakes.**
- Using the classic trailing-two-spaces hardbreak out of habit — it still works (MDI doesn't remove CommonMark features), but `[[br]]` is preferred because whitespace at line-end is fragile across editors, linters, and copy-paste.
- Expecting `[[br]][[br]]` to collapse to one break — consecutive markers insert one `<br>` each.

**Literal fallback.** `[[br]]` is only recognized in inline (paragraph) context; at block level (its own line with nothing else) it has no defined meaning and is not specially recognized as a block construct — it renders as ordinary paragraph text.

**Interaction with plain Markdown.** Inside ruby syntax (`{base|ruby}`) and inside fenced/inline code, `[[br]]` is preserved as a literal string, not parsed — matching the general rule that code spans and raw contexts keep MDI-looking text literal.

**Vertical vs. horizontal.** No difference — a line break is a line break in either direction.

## 7. Blank paragraph (空白段落)

**Purpose.** Leaves an intentional empty paragraph in rendered output — commonly used in fiction to add vertical space between scenes.

**Syntax.** A line containing only a single backslash `\` (matching `^\\[ \t]*$`) is one blank paragraph. It is always a block boundary: it ends the current paragraph even with no preceding blank line. N consecutive `\` lines make N blank paragraphs.

**Minimal example.**

```mdi
春は曙。

\

夏は夜。
```

**Full document.**

```mdi
春は曙。
\
\
\
夏は夜。
```

This produces the same three blank paragraphs as if blank lines separated each `\` — spacing around the markers doesn't matter, only their count.

**Parsed IR.**

```json
{ "type": "blank", "span": { "startByte": 5, "endByte": 6 } }
```

**Rendering output.**

```html
<p class="mdi-blank"></p>
```

```css
.mdi-blank { min-block-size: 1lh; } /* an empty <p> otherwise collapses to zero height */
```

**Common mistakes.**
- Writing this in a `.md` file and expecting the same behavior: standard Markdown renders a lone `\` line as a **literal backslash** — this meaning is MDI-specific.
- Confusing it with CommonMark's trailing backslash hardbreak (`text\` at end of a line with other content) — that's a completely different rule (§6); a blank-paragraph line contains *nothing else*.

**Literal fallback.** Inside fenced code blocks and blockquotes, a `\` line is preserved as literal text, not recognized as a blank paragraph.

**Interaction with plain Markdown.** `<br>`/`<br />` alone on a line, and the legacy `[[blank]]` macro, are **Supported alternates** — always accepted, and normalized to `\` by conforming editors on save.

**Vertical vs. horizontal.** No difference in meaning; visually, "vertical space" becomes horizontal space in the writing direction, but the markup and CSS are identical.

:::caution[Current implementation status]
`SYNTAX.md` specifies `min-block-size: 1lh` for `.mdi-blank`, which sizes the empty paragraph along the correct *logical* axis for whichever writing mode is active. `@illusions-lab/mdi-to-hast`'s stylesheet uses exactly that. `mdi-core`'s own embedded `renderHtml` stylesheet currently uses `min-height: 1em` instead — a physical (not logical) property, and a different length unit. In horizontal writing the visible difference is minor; in vertical writing, `min-height` does not correspond to the inline space a blank paragraph is supposed to reserve. See [Migration and compatibility](/ecosystem/compatibility/#stylesheet-parity).
:::

## 8. Warichu (割注)

**Purpose.** A short inline annotation set as two half-height lines within the line of text — a traditional device for brief notes that don't warrant a footnote.

**Syntax.** `[[warichu:text]]`.

**Minimal example.** `大安[[warichu:六曜の一つで吉日とされる]]であった` sets the note in small two-line type after "大安".

**Full document.**

```mdi
その日は大安[[warichu:六曜の一つで吉日とされる]]であった。
```

**Parsed IR.**

```json
{ "type": "warichu", "children": [{ "type": "text", "value": "六曜の一つで吉日とされる" }], "span": { "startByte": 12, "endByte": 32 } }
```

**Rendering output.**

```html
<span class="mdi-warichu">六曜の一つで吉日とされる</span>
```

```css
.mdi-warichu {
  display: inline-block;
  font-size: 0.5em;
  line-height: 1.1;
  max-inline-size: 10em;
  vertical-align: middle;
  text-align: start;
}
```

CSS has no native two-column warichu layout; this `inline-block` rule approximates it by wrapping the note onto short lines. Renderers targeting formats with native warichu support (some EPUB readers, InDesign) should map it directly instead of relying on this CSS approximation.

**Common mistakes.** Expecting warichu to behave like a footnote (collected at the document end) — it renders inline, at the point of use, always.

**Literal fallback.** Unbalanced `[[`/`]]` leaves the macro as literal text; there is no "empty content" special case beyond that (unlike no-break, empty warichu content is still valid warichu with an empty note).

**Interaction with plain Markdown.** Content is MDI inline content, so ruby and other bracket macros may nest inside a warichu note.

**Vertical vs. horizontal.** No difference in markup; the CSS approximation above is a horizontal-writing two-line simulation. In real vertical typesetting, warichu is two half-width *columns* rather than two half-height lines — a difference the current CSS approximation does not model.

:::caution[Current implementation status]
`SYNTAX.md`'s two-line `inline-block` approximation is shipped by `@illusions-lab/mdi-to-hast`. `mdi-core`'s own embedded `renderHtml` stylesheet currently ships only `font-size: 0.6em` for `.mdi-warichu` — a size reduction with none of the two-line wrapping behavior. Both produce the same `<span class="mdi-warichu">` markup; only the CSS differs.
:::

## 9. Kerning (字間調整)

**Purpose.** Adjusts letter-spacing for a specific run of text.

**Syntax.** `[[kern:<amount>:text]]`, where `<amount>` matches `^[+-]?\d+(\.\d+)?em$`.

**Minimal example.** `[[kern:-0.1em:確実]]` tightens "確実"; `[[kern:+0.3em:沈黙]]` loosens "沈黙".

**Full document.**

```mdi
彼は[[kern:-0.1em:確実]]にそう言った。
[[kern:+0.3em:沈黙]]が落ちた。
```

**Parsed IR.**

```json
{ "type": "kern", "amount": "-0.1em", "children": [{ "type": "text", "value": "確実" }], "span": { "startByte": 2, "endByte": 20 } }
```

**Rendering output.**

```html
<span class="mdi-kern" style="--mdi-kern:-0.1em;">確実</span>
```

```css
.mdi-kern { letter-spacing: var(--mdi-kern, 0em); }
```

**Common mistakes.**
- `[[kern:0.1:text]]` (missing the `em` unit) — fails the amount regex, so the **entire macro** is left as literal text, brackets and all.
- `[[kern:wide:text]]` — same outcome, for the same reason.

**Literal fallback.** This is the one macro where an invalid parameter invalidates the whole construct rather than falling back to a no-parameter form — unlike boten, kerning has no meaningful "no amount given" spelling.

**Interaction with plain Markdown.** Content is MDI inline content.

**Vertical vs. horizontal.** `letter-spacing` applies along the text's inline axis in both directions — no notation change is needed between writing modes.

## 10. Block alignment (字下げ・地付き)

**Purpose.** Controls indentation and end-alignment of a whole paragraph — used for colophons, signatures, poetry, and epigraphs.

**Syntax.** Written as its own line, immediately before the paragraph it modifies:

```text
[[indent:N]]    字下げ — indent every line of the block by N characters
[[bottom]]      地付き — align to the line end (地 in vertical writing)
[[bottom:N]]    地からN字上げ — align N characters up from the line end
```

`N` is a positive integer. The macro applies to exactly one following block; it does not cascade to later paragraphs.

**Minimal example.**

```mdi
[[indent:2]]
我輩は猫である。
```

**Full document.**

```mdi
[[indent:2]]
我輩は猫である。名前はまだ無い。

[[bottom]]
著者識

[[bottom:2]]
令和七年七月
```

**Parsed IR.** Indent/bottom are fields on the `paragraph` node itself, not a separate wrapper node:

```json
{ "type": "paragraph", "indent": 2, "children": [{ "type": "text", "value": "我輩は猫である。名前はまだ無い。" }], "span": { "startByte": 13, "endByte": 46 } }
```

`[[bottom]]` alone sets `"bottom": 0`; `[[bottom:2]]` sets `"bottom": 2`.

**Rendering output.**

```html
<p class="mdi-indent" style="--mdi-indent:2;">我輩は猫である。名前はまだ無い。</p>
<p class="mdi-bottom">著者識</p>
<p class="mdi-bottom" style="--mdi-shift:2;">令和七年七月</p>
```

```css
.mdi-indent { margin-inline-start: calc(var(--mdi-indent, 0) * 1em); }
.mdi-bottom { text-align: end; margin-inline-end: calc(var(--mdi-shift, 0) * 1em); }
```

**Common mistakes.**
- Stacking `[[indent:2]]` directly followed by `[[bottom]]` on the next line, expecting both to apply — indent and bottom are mutually exclusive by nature; the second macro line, having no paragraph immediately after it (only another macro line), is left as literal text instead.
- `N` of `0`, a negative number, or a non-integer — invalid, and the macro line is left as literal text.
- Writing a macro line with no paragraph following it at all (e.g., at the end of the document) — literal text.

**Literal fallback.** Like the blank-paragraph `\` line, a block-alignment macro line is always a block boundary: it ends whatever paragraph came before it even without a preceding blank line, and it is never absorbed as continuation text into that preceding paragraph.

**Interaction with plain Markdown.** `[[indent:N]]` indents **every line** of the block (a JIS "字下げ" block indent). The conventional Japanese *first-line-only* paragraph indent is unrelated to this macro — it's written the ordinary way, as a literal full-width space (`　`) at the start of the paragraph text.

**Vertical vs. horizontal.** `text-align: end` resolves to "bottom of the column" in vertical writing (地) and "right/left edge" in horizontal writing depending on directionality — the same CSS declaration is correct for both, which is the entire reason `[[bottom]]` is named for its vertical-writing meaning (地付き) but works identically in horizontal output.

## 11. Page break (改ページ)

**Purpose.** Forces a page break in paginated output (PDF, EPUB, DOCX). Continuous media (a web page) may render it as extra space or ignore it.

**Syntax.** On its own line, as a block: `[[pagebreak]]`, `[[pagebreak:right]]` (改丁, next page must be recto/right-hand), or `[[pagebreak:left]]` (verso/left-hand).

**Minimal example.**

```mdi
第一章はここで終わる。

[[pagebreak]]

第二章が始まる。
```

**Full document.** (same as above — page break is inherently a whole-document-layout concern, so a longer example wouldn't add information.)

**Parsed IR.**

```json
{ "type": "pagebreak", "variant": null, "span": { "startByte": 15, "endByte": 27 } }
```

`[[pagebreak:right]]` → `"variant": "right"`; `[[pagebreak:left]]` → `"variant": "left"`.

**Rendering output.**

```html
<div class="mdi-pagebreak" role="presentation"></div>
```

```css
.mdi-pagebreak       { break-after: page; }
.mdi-pagebreak-right { break-after: recto; }
.mdi-pagebreak-left  { break-after: verso; }
```

`recto`/`verso` have limited CSS support in browsers; the EPUB and DOCX renderers map 改丁 to each format's own native page-break property instead of relying on this CSS. Confirmed in `mdi-core`: `render_epub_document` starts a new EPUB chapter file at every `pagebreak` node, and `render_docx_document` emits a native OOXML `<w:br w:type="page"/>`.

**Common mistakes.** Expecting a page break mid-paragraph — like blank paragraphs and block-alignment macros, `[[pagebreak]]` is always a block boundary and cannot appear inside running text.

**Literal fallback.** A malformed variant (anything other than `left`/`right` after the colon) doesn't match the page-break grammar at all, so the line is parsed as an ordinary paragraph containing that literal text.

**Interaction with plain Markdown.** None — this is a pure block-level construct with no inline content.

**Vertical vs. horizontal.** No difference in meaning; "recto"/"verso" (right-hand/left-hand page) is a page-progression concept independent of writing direction, though in practice vertical Japanese books almost always use `page-progression: rtl`, which is why 改丁 exists as a distinct notation from a plain page break.

## 12. Footnotes (脚注)

**Purpose.** MDI **inherits** the GFM/Pandoc footnote syntax outright — no MDI-specific notation exists for this.

**Syntax.** `[^id]` as a reference, `[^id]: text` as the definition (anywhere in the document, conventionally at the end).

**Minimal example.**

```mdi
彼はその話を信じなかった[^1]。

[^1]: 後に事実と判明する。
```

**Full document.** (same as above.)

**Parsed IR.** Standard mdast `footnoteReference` / `footnoteDefinition` nodes, unchanged by MDI:

```json
{ "type": "footnoteReference", "identifier": "1", "label": "1", "span": { "startByte": 12, "endByte": 16 } }
```

**Rendering output.**

```html
彼はその話を信じなかった<sup class="footnote-ref">1</sup>。
```

`render_html_document` collects `footnoteDefinition` nodes and appends them as an ordered list after the main content, with back-links.

**Common mistakes.** Expecting a Japanese-style 傍注 (margin note) by default — endnote collection at the document end is the current and only rendering; margin notes are a renderer option a future implementation *may* add, per `SYNTAX.md`, not a guarantee.

**Literal fallback.** An identifier with no matching definition renders as an unresolved reference per the host Markdown implementation's own footnote behavior — MDI adds no special-case handling here.

**Interaction with plain Markdown.** None beyond ordinary GFM footnotes — this section exists on this page only because `SYNTAX.md` documents the rendering convention (endnotes vs. margin notes) as part of the MDI contract, even though the notation itself is unmodified GFM.

**Vertical vs. horizontal.** Both currently render as endnotes at the document's end; `SYNTAX.md` allows (but does not require) a vertical-writing renderer to offer 傍注 margin notes as an alternative.

## 13. Escapes (エスケープ)

**Purpose.** Writes an MDI delimiter character as literal text.

**Syntax.** `\` before any of: `{` `}` `|` `^` `[` `]` `:` `《` `》`.

**Minimal example.** `\{literal braces\}` renders as `{literal braces}`, not as an unmatched ruby delimiter.

**Full document.**

```mdi
\{東京\|とうきょう\} \^12\^ \[\[br\]\] \《《文字\》》
```

**Parsed IR.** Escapes are resolved into plain `text` nodes before any MDI construct is recognized — there is no separate "escape" node type in the IR; by the time the tree exists, `\{` is already just the character `{`.

**Rendering output.**

```html
{東京|とうきょう} ^12^ [[br]] 《《文字》》
```

**Common mistakes.**
- Escaping a character that isn't a delimiter, e.g. `\a` — MDI's escapable set is fixed (the nine characters above, plus `\\` itself for a literal backslash); `\a` is left as the two literal characters `\a`, matching CommonMark's own behavior for non-punctuation escapes.
- Forgetting that inside a GFM **table cell**, `\|` is consumed by GFM's table-cell-splitting rule *before* MDI ever runs its own escape pass — the resulting `|` is an ordinary character that *does* participate in MDI matching, which is exactly why ruby works inside table cells (see §2's table-cell note). This means a genuinely literal `|` inside ruby syntax inside a table cell cannot be written at all; restructure the content instead.

**Literal fallback.** N/A — escapes have no separate fallback; an escaped character simply never participates in delimiter matching.

**Interaction with plain Markdown.** MDI's escape set is entirely separate from CommonMark's own backslash-escape set (CommonMark escapes ASCII punctuation like `\*`, `\_`, `\``); the two lists overlap only where a character happens to be in both, and each is processed by its own layer — MDI's once, first, before MDI inline parsing; CommonMark's own during ordinary Markdown parsing.

**Vertical vs. horizontal.** No difference — escaping is purely a source-text concern.

## Parsing order

Implementations process MDI syntax in this order (normative in `SYNTAX.md`):

**Block stage:** (1) front matter, (2) standard Markdown block structure, (3) blank-paragraph lines (`\`, `<br>`, `[[blank]]`), (4) block macros (`[[pagebreak]]`, `[[indent:N]]`, `[[bottom]]`, `[[bottom:N]]`).

**Inline stage**, inside each paragraph: (5) escape processing, (6) ruby, (7) the `《《...》》` boten alias, (8) tate-chu-yoko, (9) bracket macros (`[[br]]`, `[[no-break:...]]`, `[[em:...]]`, `[[warichu:...]]`, `[[kern:...:...]]`), (10) footnote references.

## Inline nesting

*Normative in MDI 2.0.*

- **Bracket macro content is MDI inline content.** `[[em:...]]`, `[[no-break:...]]`, `[[warichu:...]]`, and `[[kern:...:...]]` all parse their content as MDI inline syntax — ruby, tate-chu-yoko, and other bracket macros may appear inside. `[[em:{東京|とうきょう}]]` places boten on ruby-annotated text.
- **Closing is balanced by counting**, not by nearest match: `[[` / `]]` pairs nest, and escaped brackets (`\[`, `\]`) don't count. In `[[em:foo[[no-break:bar]]baz]]`, the first `]]` closes `no-break`; the second closes `em`.
- **Ruby, tate-chu-yoko, and `《《...》》` content is plain text** — no MDI construct is recognized inside `{...|...}` (either side), `^...^` (excluded by its charset), or `《《...》》`.
- **Rendering nests naturally.** HTML output nests the corresponding elements, e.g. `<span class="mdi-em" ...><ruby class="mdi-ruby">...</ruby></span>`. The stylesheet suppresses duplicate emphasis marks on nested ruby text: `.mdi-em rt { text-emphasis: none; }`.

## TXT export flavors

HTML/PDF/EPUB share one CSS-driven rendering model, but plain text has no styling layer, so every MDI construct is flattened to a specific textual convention — and more than one such convention exists in real-world use. `render_text_format` (Rust) and the CLI's `--to <flavor>` implement five:

| Flavor | Ruby | Boten | Notes |
| --- | --- | --- | --- |
| `txt` (plain) | discarded — base text only | discarded | Simplest export. |
| `txt-ruby` | `base{reading}`-style round-trip spelling | kept as plain text (mark discarded) | Preserves enough to reconstruct ruby later. |
| `narou` | `｜base《reading》` | per-character dot ruby (site has no boten notation) | 小説家になろう submission format. |
| `kakuyomu` | `｜base《reading》` | native `《《text》》` notation | カクヨム submission format — differs from `narou` *only* in the boten row. |
| `aozora` | `base《reading》` | `text［＃「text」に傍点］` | 青空文庫 (Aozora Bunko) annotation convention; output is re-encoded to Shift_JIS by the CLI. |

Any construct with no equivalent in a given flavor is flattened to its base text with the macro simply dropped. See the [CLI page](/bindings/cli/#text-formats) for the exact commands, and `SYNTAX.md`'s [TXT Export Flavors](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md#txt-export-flavors--txt-書き出しフレーバー) section for the complete mapping table, including `[[warichu:...]]`, `[[indent:N]]`, and page breaks.

## Next steps

- [Live showcase](/syntax/showcase/) — every construct above, rendered live by this documentation site.
- [Document IR](/core/document-ir/) — the full node-type catalogue in one place.
- [Ecosystem: Migration and compatibility](/ecosystem/compatibility/) — every current spec-vs-implementation gap, tracked in one page.
