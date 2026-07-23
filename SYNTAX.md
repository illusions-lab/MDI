# MDI Syntax Reference / MDI 構文リファレンス

> **illusion Markdown (`.mdi`)** extends standard Markdown with Japanese typography syntax.  
> All standard Markdown syntax (headings, lists, links, tables, etc.) is fully inherited — only MDI-specific extensions are documented here.
>
> **illusion Markdown (`.mdi`)** は標準 Markdown に日本語組版向けの拡張構文を加えたフォーマットです。  
> 見出し・リスト・リンク・表など標準 Markdown の記法はすべてそのまま使えます。このドキュメントでは **MDI 固有の拡張のみ** を解説します。

**This document describes MDI 2.0.** The MDI 1.0 specification is preserved on the [`spec/v1.0`](../../tree/spec/v1.0) branch.  
**本ドキュメントは MDI 2.0 の仕様です。** MDI 1.0 の仕様は [`spec/v1.0`](../../tree/spec/v1.0) ブランチに保存されています。

---

## Design Principles / 設計原則

1. **One recommended form per feature.** Every MDI feature has exactly one **Recommended** notation. Conforming editors and exporters always emit the recommended form, and normalize any alternate form to it on save.  
   **機能ごとに推奨記法は一つ。** すべての機能に**推奨（Recommended）**記法を一つだけ定めます。準拠エディタ・エクスポータは常に推奨記法で出力し、保存時に他の記法を推奨記法へ正規化します。

2. **Alternate forms stay supported.** Notations marked **Supported** are a permanent part of the grammar, kept for backward compatibility and interoperability. Conforming parsers must accept them, and they are never removed within a major version.  
   **互換記法は削除しない。** **互換（Supported）**と記された記法は後方互換・相互運用のための文法の一部です。準拠パーサは必ず受理し、メジャーバージョン内で削除されることはありません。

3. **Naming follows the most established typographic vocabulary.** Macro names use CSS terms where a CSS equivalent exists (`em` ← `text-emphasis`, `kern`, `br`), and JLReq romanization for Japanese-specific devices without one (`warichu`, tate-chu-yoko).  
   **命名は組版業界で最も通用する語彙に従う。** CSS に対応概念があるものは CSS の用語（`em` ← `text-emphasis`、`kern`、`br`）、ないものは JLReq のローマ字表記（`warichu`、縦中横）を用います。

4. **Characters are counted in grapheme clusters.** Wherever this spec counts "characters" (文字) — the boten mark's single character, the base-character count of split ruby, the length limit of tate-chu-yoko — one character means one **extended grapheme cluster** (Unicode UAX #29). A surrogate-pair kanji such as `𠮟` is one character; a ZWJ emoji sequence is one character.  
   **文字数は書記素クラスタで数える。** 本仕様で「文字」を数える箇所（傍点記号の 1 文字、分割ルビの親文字数、縦中横の文字数上限）はすべて **拡張書記素クラスタ**（Unicode UAX #29）を単位とします。サロゲートペアの漢字（`𠮟` など）は 1 文字、ZWJ 絵文字シーケンスも 1 文字です。

---

## Table of Contents / 目次

1. [Front Matter 「フロントマター」](#1-front-matter-フロントマター)
2. [Ruby 「ルビ」](#2-ruby-ルビ)
3. [Tate-chu-yoko 「縦中横」](#3-tate-chu-yoko-縦中横)
4. [Boten 「傍点」](#4-boten-傍点) **New in 2.0**
5. [No-break 「改行抑止」](#5-no-break-改行抑止)
6. [Explicit Line Break 「改行マーカー」](#6-explicit-line-break-改行マーカー)
7. [Blank Paragraph 「空白段落」](#7-blank-paragraph-空白段落) **Revised in 2.0**
8. [Warichu 「割注」](#8-warichu-割注) **New in 2.0**
9. [Kerning 「字間調整」](#9-kerning-字間調整)
10. [Block Alignment 「字下げ・地付き」](#10-block-alignment-字下げ地付き) **New in 2.0**
11. [Page Break 「改ページ」](#11-page-break-改ページ) **New in 2.0**
12. [Footnotes 「脚注」](#12-footnotes-脚注) **New in 2.0**
13. [Escapes 「エスケープ」](#13-escapes-エスケープ)
14. [Quick Reference / クイックリファレンス](#14-quick-reference--クイックリファレンス)

---

## 1. Front Matter 「フロントマター」

*New in 2.0.*

Document-level properties are declared in a YAML front matter block at the top of the file. Writing mode affects how tate-chu-yoko, boten, and footnotes are rendered, so it is a **document property**, not a stylesheet concern.  
文書レベルの属性はファイル先頭の YAML フロントマターで宣言します。縦書きか横書きかは縦中横・傍点・脚注の描画に影響するため、CSS ではなく**文書の属性**として扱います。

### Syntax / 構文

```yaml
---
mdi: "2.0"
title: 雪女
author: 小泉八雲
writing-mode: vertical
---
```

### Keys / キー

| Key | Values | Default | Meaning |
|-----|--------|---------|---------|
| `mdi` | version string | latest supported | MDI spec version the document targets; when absent (including documents with no front matter), treated as the **latest version the parser supports** / 対象仕様バージョン。省略時（フロントマターなしを含む）は**パーサが対応する最新バージョン**として扱う |
| `title` | string | — | Document title / 作品タイトル |
| `author` | string | — | Author / 著者 |
| `lang` | BCP 47 tag | `ja` | Document language; drives the HTML `lang` attribute and EPUB `dc:language` / 文書の言語。HTML の `lang` 属性・EPUB の `dc:language` に反映 |
| `date` | ISO 8601 date | — | Publication date; used in export metadata (e.g. EPUB `dc:date`, colophons) / 発行日。EPUB の `dc:date` や奥付などに使用 |
| `writing-mode` | `horizontal` \| `vertical` | `horizontal` | Text direction / 横書き・縦書き |
| `page-progression` | `ltr` \| `rtl` | derived | Page turn direction; defaults to `rtl` when `writing-mode: vertical`, otherwise `ltr` / ページ進行方向 |

Unknown keys are preserved but ignored by renderers.  
未知のキーは保持されますが、レンダラーは無視します。

A parser encountering an `mdi` version **newer than it supports** SHOULD warn and parse on a best-effort basis using the rules it knows; it MUST NOT refuse the document outright.  
パーサは、自身が対応するより**新しい** `mdi` バージョンに遭遇した場合、警告を出した上で既知の規則によるベストエフォート解析を行うべきです（SHOULD）。文書の受理自体を拒否してはなりません（MUST NOT）。

### HTML Output / HTML 出力

`writing-mode: vertical` applies `writing-mode: vertical-rl` to the rendering container.  
`writing-mode: vertical` はレンダリングコンテナに `writing-mode: vertical-rl` を適用します。

---

## 2. Ruby 「ルビ」

### Syntax / 構文

```
{親文字|ルビ}
```

- The text **left of `|`** is the base (親文字).
- The text **right of `|`** is the ruby (ルビ).
- Use `.` (dot) inside the ruby text to map ruby segments to individual base characters (**split ruby**).
- Without dots, the entire ruby is applied to the entire base as one unit (**group ruby**).

---

- `|` の**左側**が親文字。
- `|` の**右側**がルビ。
- ルビ側に `.`（ドット）を挟むと、各文字に個別にルビを振る**分割ルビ**になります。
- ドットなしの場合は親文字全体に一つのルビを振る**グループルビ**です。

### Examples / 例

| MDI | Meaning |
|-----|---------|
| `{東京|とうきょう}` | Group ruby — 東京 with とうきょう |
| `{東京|とう.きょう}` | Split ruby — 東 with とう, 京 with きょう |
| `{雪女|ゆき.おんな}` | Split ruby — 雪 with ゆき, 女 with おんな |
| `{彼女|かのじょ}が来た。` | Ruby inside a sentence |

```markdown
私は{雪女|ゆき.おんな}を見た。
{東京|とう.きょう}は雨だった。
{彼女|かのじょ}は{微笑|ほほえ}んだ。
```

### HTML Output / HTML 出力

**Split ruby:**
```html
<ruby class="mdi-ruby">東<rp>（</rp><rt>とう</rt><rp>）</rp>京<rp>（</rp><rt>きょう</rt><rp>）</rp></ruby>
```

**Group ruby:**
```html
<ruby class="mdi-ruby">東京<rp>（</rp><rt>とうきょう</rt><rp>）</rp></ruby>
```

*Changed in 2.0:* output now includes `<rp>` fallback parentheses for environments without ruby support.  
*2.0 での変更:* ルビ非対応環境向けのフォールバックとして `<rp>` を出力に含めます。

### Edge Cases / 境界条件

- In split ruby, if the number of dot-separated segments does not equal the number of base characters (counted in grapheme clusters, see Design Principle 4), or any segment is empty (e.g. `{東京|.きょう}`), the ruby falls back to **group ruby** (dots removed).  
  分割ルビでドット区切りの数が親文字の文字数（書記素クラスタ単位。設計原則 4 参照）と一致しない場合、または空のセグメントがある場合（例: `{東京|.きょう}`）は**グループルビ**として扱います（ドットは除去）。
- To include a literal `|`, `.`, `{`, or `}` inside ruby syntax, escape it with `\` (see [Escapes](#13-escapes-エスケープ)).  
  親文字・ルビに `|` `.` `{` `}` を含める場合は `\` でエスケープします。
- Inside a GFM table cell, write the ruby separator as `\|` (a bare `|` splits the cell). Table parsing runs at the block stage and unescapes `\|` before MDI inline parsing, so `{東京\|とうきょう}` in a cell produces normal ruby.  
  GFM の表のセル内では、ルビの区切りを `\|` と書きます（素の `|` はセル区切りになるため）。表の解析はブロック段階で行われ、`\|` は MDI インライン解析の前に `|` へ戻されるので、セル内の `{東京\|とうきょう}` は通常どおりルビになります。

---

## 3. Tate-chu-yoko 「縦中横」

Tate-chu-yoko renders a short sequence of characters (numbers, Latin letters) horizontally within vertical text.  
縦書きの中で数字や短いラテン文字を横向きに組む「縦中横」の記法です。

### Syntax / 構文

```
^テキスト^
```

Enclose the target characters with carets `^`.  
縦中横にしたい文字列をキャレット `^` で囲みます。

### Examples / 例

| MDI | Rendered as |
|-----|-------------|
| `第^12^話` | 第 (12横組み) 話 |
| `令和^7^年` | 令和 (7横組み) 年 |
| `^OK^` | (OK横組み) |

```markdown
第^12^話
令和^7^年
^ABC^の略語
```

### HTML Output / HTML 出力

```html
<span class="mdi-tcy">12</span>
```

CSS applies `text-combine-upright` on this element when inside a vertical writing container.  
縦書きコンテナ内では CSS の `text-combine-upright` が適用されます。

**Notes / 注意事項:**

- The content must match `^[0-9A-Za-z!?]{1,6}$` — halfwidth alphanumerics plus `!` `?`, one to six characters. Anything else (spaces, CJK, symbols) does not form tate-chu-yoko and the carets remain literal. This reflects actual TCY usage (JIS/JLReq: short runs of digits and Latin) and prevents false matches in text like `(^_^)`.  
  中身は `^[0-9A-Za-z!?]{1,6}$`（半角英数字と `!` `?`、1〜6 文字）に一致する必要があります。それ以外（空白・全角文字・記号）は縦中横にならず、`^` はリテラルのままです。縦中横の実際の用途（JIS/JLReq: 数字・短いラテン文字）に沿った制限で、`(^_^)` のような文字列の誤認も防ぎます。
- The pair must open and close **within the same line**; an unmatched `^` is literal text.  
  `^` の対は**同一行内**で閉じる必要があります。閉じない `^` はリテラルとして扱います。
- Pandoc interprets `^text^` as superscript. In `.mdi` files it is always tate-chu-yoko.  
  Pandoc では `^text^` は上付き文字ですが、`.mdi` では常に縦中横です。
- In horizontal writing, the `.mdi-tcy` span is inert — `text-combine-upright` has no effect outside a vertical writing container, and the text renders normally. The markup is still emitted, so switching `writing-mode` requires no re-parse.  
  横書きでは `.mdi-tcy` は不活性です。`text-combine-upright` は縦書きコンテナ外では効果を持たず、テキストは通常どおり描画されます。マークアップ自体は出力されるため、`writing-mode` の切り替えに再パースは不要です。

---

## 4. Boten 「傍点」

*New in 2.0.*

Boten (emphasis dots, 圏点) places emphasis marks alongside each character — the standard emphasis device in Japanese typography, where italics are unnatural.  
傍点（圏点）は文字の脇に強調記号を打つ、日本語組版の標準的な強調手法です。

### Syntax / 構文

**Recommended / 推奨:**

```
[[em:テキスト]]
[[em:<mark>:テキスト]]
```

**Supported / 互換:**

```
《《テキスト》》
```

`[[em:...]]` is the recommended form and the only form that accepts a mark parameter. `<mark>` is **any single character** — not a fixed keyword — giving full freedom to pick whatever emphasis glyph the author wants (e.g. `[[em:﹅:決して]]`, `[[em:●:決して]]`, or any other single character). `《《...》》` (Kakuyomu notation) is a supported alternate: it always renders the default mark, and editors normalize it to `[[em:...]]` on save. The name `em` follows the CSS property `text-emphasis`.  
`[[em:...]]` が推奨記法で、記号指定ができるのはこの形のみです。`<mark>` は固定キーワードではなく**任意の 1 文字**で、著者が好きな強調記号を自由に選べます（例: `[[em:﹅:決して]]`、`[[em:●:決して]]`、その他任意の 1 文字）。`《《...》》`（カクヨム記法）は互換記法です。常にデフォルト記号で描画され、保存時に `[[em:...]]` へ正規化されます。`em` という名前は CSS プロパティ `text-emphasis` に由来します。

**Disambiguation rules / 曖昧性の解決:**

- In `[[em:...]]`, the segment before the first `:` is treated as a mark **only if** it is **exactly one character** (one grapheme cluster; whitespace and control characters are excluded) **and** at least one more `:` follows. Otherwise the entire content is the text.  
  `[[em:...]]` では、最初の `:` より前の部分が記号と見なされるのは、**ちょうど 1 文字（書記素クラスタ 1 つ。空白・制御文字は不可）であり、かつ後ろにもう一つ `:` がある場合のみ**です。それ以外はすべて本文として扱います。
  - `[[em:dot]]` → boten with the default mark on the text "dot" / 既定の記号で「dot」に傍点
  - `[[em:●:それ]]` → mark `●` on 「それ」 / 記号 `●` で「それ」に傍点
  - A literal `:` in the text is written `\:` / 本文中の `:` は `\:` と書きます
- The content of `《《...》》` must not contain `《` or `》`; otherwise the pair is literal text. This keeps nested CJK title quotes (e.g. `《《雪》考》`) safe. Write `\《` for a literal mark inside.  
  `《《...》》` の中身に `《` `》` を含めることはできません（含む場合はリテラル扱い）。書名号の入れ子（例: `《《雪》考》`）を誤認しないためです。

### Default mark and conventional choices / 既定の記号と慣用例

The default mark (used when `<mark>` is omitted) is `﹅` (ゴマ点). Any single character is valid, but Japanese typography has a small set of conventional marks — pick whichever fits, or use something else entirely:  
`<mark>` を省略した場合の既定記号は `﹅`（ゴマ点）です。任意の 1 文字を使えますが、日本語組版には慣用的によく使われる記号があります。好きなものを選ぶか、それ以外の文字を使っても構いません。

| Mark | Name |
|------|------|
| `﹅` *(default)* | ゴマ点 |
| `﹆` | 白ゴマ点 |
| `•` | 黒点 |
| `◦` | 白点 |
| `●` | 黒丸 |
| `○` | 白丸 |
| `▲` | 黒三角 |
| `△` | 白三角 |

Unicode already provides distinct code points for filled/hollow variants of each shape (`●`/`○`, `▲`/`△`, `﹅`/`﹆`), so the mark character alone fully determines the rendered glyph — there is no separate "filled vs. open" modifier to configure.  
Unicode には各形状の実心・中空バリアントがそれぞれ別の符号位置として存在するため（`●`/`○`、`▲`/`△`、`﹅`/`﹆`）、記号 1 文字だけで描画されるグリフが確定します。「実心か中空か」を別途指定する仕組みはありません。

A `<mark>` segment that is not exactly one character (or is whitespace/control) simply does not match the mark position — the macro is still boten, with the entire content treated as text (e.g. `[[em:ab:cd]]` puts the default mark on "ab:cd"). Note this fallback differs from [Kerning](#9-kerning-字間調整), where an invalid amount makes the **whole macro** literal text: boten has a meaningful no-parameter form, kerning does not.  
`<mark>` の位置が 1 文字ちょうどでない場合（空白・制御文字を含む）は記号として一致しないだけで、マクロ自体は傍点のまま、内容全体を本文として扱います（例: `[[em:ab:cd]]` は「ab:cd」に既定記号で傍点）。このフォールバックは[字間調整](#9-kerning-字間調整)とは異なります。字間調整では量が無効なとき**マクロ全体**がリテラルになります — 傍点には無引数の形が存在し、字間調整には存在しないためです。

### Examples / 例

```markdown
彼は[[em:それ]]を見た。
[[em:○:決して]]忘れない。
彼は《《それ》》を見た。
```

### HTML Output / HTML 出力

```html
<span class="mdi-em" style="--mdi-em:&quot;﹅&quot;;">それ</span>
```

```css
.mdi-em {
  text-emphasis: var(--mdi-em, "﹅");
  -webkit-text-emphasis: var(--mdi-em, "﹅");
  text-emphasis-position: over right;
}
```

The mark is emitted as a CSS `<string>` (`text-emphasis-style` accepts an arbitrary single-character string, not just its keyword shapes), so any `<mark>` character round-trips to the render exactly as authored. When emitting, `"` and `\` in the mark MUST be escaped per CSS string rules (and per HTML attribute rules in the `style` attribute).  
記号は CSS の `<string>` 形式で出力されます（`text-emphasis-style` はキーワード形状だけでなく任意の 1 文字の文字列も受理します）。これにより、どの `<mark>` を指定しても著者の入力どおりに描画されます。出力時、記号に含まれる `"` と `\` は CSS 文字列規則（および `style` 属性内では HTML 属性規則）に従ってエスケープしなければなりません（MUST）。

`text-emphasis-position: over right` places marks above the text in horizontal writing and to the right in vertical writing.  
`text-emphasis-position: over right` により、横書きでは文字の上、縦書きでは右側に傍点が付きます。

---

## 5. No-break 「改行抑止」

Prevents a line break from occurring inside a proper noun or fixed phrase.  
固有名詞や熟語の途中で改行が入らないようにします。

### Syntax / 構文

```
[[no-break:テキスト]]
```

### Examples / 例

```markdown
[[no-break:東京都新宿区]]に住んでいます。
事件名は[[no-break:被愛妄想罪]]です。
```

### HTML Output / HTML 出力

```html
<span class="mdi-nobr">東京都新宿区</span>
```

```css
.mdi-nobr {
  white-space: nowrap;
  word-break: keep-all;
}
```

---

## 6. Explicit Line Break 「改行マーカー」

### Overview / 概要

MDI distinguishes two kinds of breaks:

| Type | MDI | Meaning |
|------|-----|---------|
| **Line break** (改行) | `[[br]]` | Break within a paragraph — stays in the same `<p>` |
| **Paragraph break** (換段) | blank line | CommonMark blank line — starts a new `<p>` |

MDI では「改行」と「換段」を明確に区別します。

| 種別 | MDI | 意味 |
|------|-----|------|
| **改行** | `[[br]]` | 段落の中で行を折り返す（同じ `<p>` に留まる） |
| **換段** | 空行 | CommonMark の空行 — 新しい `<p>` が始まる |

### `[[br]]` — Inline Line Break / 段落内改行

Insert `[[br]]` anywhere inside a paragraph to force a line break.  
段落の途中に `[[br]]` を挿入すると、その位置で強制改行されます。

```markdown
春は曙。[[br]]
やうやう白くなりゆく山ぎは、少し明かりて、
```

**HTML Output:**
```html
春は曙。<br class="mdi-break" />やうやう白くなりゆく山ぎは、少し明かりて、
```

**Notes / 注意事項:**

- `.mdi` files only — has no effect in `.md` files.
- Valid only in inline (paragraph) context; ignored at block level.
- Multiple consecutive `[[br]][[br]]` inserts multiple line breaks.
- Inside ruby syntax `{base|ruby}`, `[[br]]` is treated as a literal string.
- Inside fenced code blocks and inline code, `[[br]]` is preserved as literal text.
- `[[br]]` is preferred over trailing two-space hardbreak (`  \n`), which is fragile across external tools and copy-paste.

---

- `.mdi` ファイル専用。`.md` では効果なし。
- inline（段落）コンテキストのみ有効。ブロックレベルでは無視。
- `[[br]][[br]]` と連続させると複数回の改行として扱われます。
- ルビ構文 `{親文字|ルビ}` 内では `[[br]]` はリテラル文字列として扱われます。
- コードブロック・インラインコード内ではリテラルとして保持されます。
- 末尾 2 スペース改行 (`  \n`) はコピペや外部ツールで失われやすいため、`.mdi` では `[[br]]` を推奨します。

### Paragraph Break / 換段

Use a **blank line** (CommonMark) to start a new paragraph. MDI does not introduce a native `[[pr]]` syntax for this — a blank line is sufficient and universally compatible.  
段落を分けるには CommonMark に準拠した**空行**を使います。MDI 独自の換段マーカーは設けていません。

```markdown
春は曙。やうやう白くなりゆく山ぎは。

夏は夜。月のころはさらなり。
```

---

## 7. Blank Paragraph 「空白段落」

*Revised in 2.0.*

A blank paragraph is an intentional empty line in the rendered output — commonly used in fiction to leave vertical space between scenes.  
空白段落は、描画結果に意図的な空行を残すためのものです。小説で場面の間に余白を置く用途が典型です。

### Syntax / 構文

**Recommended / 推奨:**

A line consisting of only a backslash `\` is one blank paragraph.  
`\` 一文字だけの行が、空白段落 1 つになります。

```markdown
春は曙。

\

夏は夜。
```

**Each `\` line counts as exactly one blank paragraph.** N consecutive `\` lines produce N empty paragraphs, whether or not blank lines separate them.  
**`\` の行 1 つが空白段落 1 つに対応します。** `\` の行を N 行連続させると N 個の空段落になります（間に空行を挟んでも挟まなくても同じ）。

```markdown
春は曙。

\
\
\

夏は夜。
```

→ three empty paragraphs between the two sentences. / 2 つの文の間に空段落が 3 つ入ります。

**Supported forms / 互換記法:**

| Form | Status | Behavior |
|------|--------|----------|
| `<br>` / `<br />` alone on a line | Supported | One blank paragraph. Typically produced by HTML paste; normalized to `\` on save / 保存時に `\` へ正規化 |
| `[[blank]]` | Supported (v1.0) | One blank paragraph; normalized to `\` on save / 保存時に `\` へ正規化 |

**Parsing rules / 解析規則:**

- A blank paragraph line matches `^\\[ \t]*$` — a single backslash, optionally followed by trailing whitespace.  
  空白段落の行は `^\\[ \t]*$`（バックスラッシュ 1 文字＋任意の行末空白）に一致する必要があります。
- A blank paragraph line is always a **block boundary**: it terminates the current paragraph even without a preceding blank line.  
  空白段落の行は常に**ブロック境界**です。直前に空行がなくても、その時点で段落は終了します。

```markdown
春は曙。
\
夏は夜。
```

→ 「春は曙。」 and 「夏は夜。」 are separate paragraphs with one blank paragraph between them. / 「春は曙。」と「夏は夜。」は別々の段落になり、間に空段落が 1 つ入ります。

### Behavior / 挙動

| Context | Behavior |
|---------|----------|
| Editor | Rendered as an editable empty paragraph (`<p class="mdi-blank">`) |
| TXT export | Empty line |
| HTML export | `<p class="mdi-blank"></p>` |
| DOCX export | Empty paragraph |

| コンテキスト | 挙動 |
|------------|------|
| エディタ | 編集可能な空段落 (`<p class="mdi-blank">`) として描画 |
| TXT 出力 | 空行 |
| HTML 出力 | `<p class="mdi-blank"></p>` |
| DOCX 出力 | 空段落 |

```css
.mdi-blank {
  min-block-size: 1lh; /* an empty <p> otherwise collapses to zero height */
}
```

**Notes / 注意事項:**

- `.mdi` files only. In standard Markdown a lone `\` renders as a literal backslash — this semantic is MDI-specific.  
  `.mdi` ファイル専用。標準 Markdown では `\` 単独の行はリテラルの `\` として描画されます。この意味づけは MDI 固有です。
- This is distinct from the CommonMark **trailing** backslash (`text\` at end of line = hard break inside a paragraph). A `\` line contains nothing else.  
  CommonMark の**行末**バックスラッシュ（`テキスト\` = 段落内の強制改行）とは別物です。空白段落の `\` は行にそれ以外の文字を含みません。
- Inside fenced code blocks and blockquotes, `\`, `<br>`, and `[[blank]]` are preserved as literal text.  
  コードブロック・引用ブロック内ではすべてリテラルとして保持されます。

---

## 8. Warichu 「割注」

*New in 2.0.*

Warichu is an inline annotation set in two half-height lines within the line of text — a traditional Japanese typographic device for short notes.  
割注は、本文の行内に二行組の小さな注記を挿入する伝統的な組版手法です。

### Syntax / 構文

```
[[warichu:テキスト]]
```

### Examples / 例

```markdown
その日は大安[[warichu:六曜の一つで吉日とされる]]であった。
```

### HTML Output / HTML 出力

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

CSS has no native warichu support; the inline-block approximation above wraps the note into two short lines. Renderers targeting formats with native warichu (e.g. InDesign, some EPUB readers) should map it directly.  
CSS に割注のネイティブサポートはないため、上記の inline-block による近似で二行組を再現します。割注をネイティブに持つ出力先（InDesign 等）ではそちらへマップします。

---

## 9. Kerning 「字間調整」

Adjusts letter-spacing for a specific run of text.  
特定の文字列の字間（letter-spacing）を調整します。

### Syntax / 構文

```
[[kern:<量>:<文字列>]]
```

- `<量>`: an `em` value, e.g. `-0.1em`, `+0.2em`, `0em`.
- `<文字列>`: the text to which kerning is applied.

### Examples / 例

```markdown
彼は[[kern:-0.1em:確実]]にそう言った。
[[kern:+0.3em:沈黙]]が落ちた。
[[kern:0em:通常]]の字間。
```

### HTML Output / HTML 出力

```html
<span class="mdi-kern" style="--mdi-kern:-0.1em;">確実</span>
```

```css
.mdi-kern {
  letter-spacing: var(--mdi-kern, 0em);
}
```

**Validation / バリデーション:**  
`<量>` must match `^[+-]?\d+(\.\d+)?em$`. Invalid values are treated as plain text.  
`<量>` は `^[+-]?\d+(\.\d+)?em$` に一致する必要があります。無効な値はリテラル文字列として扱われます。

---

## 10. Block Alignment 「字下げ・地付き」

*New in 2.0.*

Controls indentation and end-alignment of a paragraph — used for colophons, signatures, poetry, and epigraphs.  
段落の字下げ・地付き・字上げを指定します。奥付・署名・和歌・題辞などに使います。

### Syntax / 構文

A block alignment macro is written **on its own line, immediately before the paragraph it modifies**.  
ブロック指定マクロは、**対象の段落の直前に単独の行として**書きます。

```
[[indent:N]]    ... N字下げ (indent N characters from the line head)
[[bottom]]      ... 地付き (align to the line end / bottom in vertical)
[[bottom:N]]    ... 地からN字上げ (align N characters up from the line end)
```

`N` is a positive integer (number of characters). The macro applies to exactly one following block; it does not cascade.  
`N` は正の整数（字数）です。マクロは直後の 1 ブロックだけに適用され、それ以降には及びません。

### Examples / 例

```markdown
[[indent:2]]
我輩は猫である。名前はまだ無い。

[[bottom]]
著者識

[[bottom:2]]
令和七年七月
```

`[[indent:N]]` indents **every line** of the block (JIS「字下げ」 for a block). The conventional **first-line** indent of a Japanese paragraph is written as a literal full-width space (`　`) at the head of the paragraph, as usual — no macro is involved.  
`[[indent:N]]` はブロックの**全行**を字下げします（ブロックの字下げ）。段落冒頭の慣習的な**一字下げ**は、従来どおり行頭に全角スペース（`　`）を書きます。マクロは使いません。

### HTML Output / HTML 出力

```html
<p class="mdi-indent" style="--mdi-indent:2;">我輩は猫である。名前はまだ無い。</p>
<p class="mdi-bottom">著者識</p>
<p class="mdi-bottom" style="--mdi-shift:2;">令和七年七月</p>
```

```css
.mdi-indent {
  margin-inline-start: calc(var(--mdi-indent, 0) * 1em);
}
.mdi-bottom {
  text-align: end;
  margin-inline-end: calc(var(--mdi-shift, 0) * 1em);
}
```

In vertical writing, `end` = the bottom of the column (地), so the same output works for both writing modes.  
縦書きでは `end` が行末（地）になるため、同一の出力が縦横両対応になります。

**Notes / 注意事項:**

- A block alignment macro line is always a **block boundary**, like the blank-paragraph `\` line (§7): it terminates the current paragraph even without a preceding blank line, and is never absorbed into the preceding paragraph as continuation text.  
  ブロック指定マクロの行は、空白段落の `\` 行（第7節）と同様、常に**ブロック境界**です。直前に空行がなくても、その時点で段落は終了し、前の段落の継続行として吸収されることはありません。
- A block alignment macro not followed by a paragraph is treated as plain text. This includes a block macro followed by another block macro line — **stacking is not allowed** (`[[indent:2]]` and `[[bottom]]` are mutually exclusive by nature).  
  直後に段落が続かない場合はリテラル文字列として扱います。ブロックマクロの直後に別のブロックマクロ行が来る場合も同様で、**重ね掛けはできません**（字下げと地付きは本来排他です）。
- Invalid `N` (zero, negative, non-integer) → plain text.  
  無効な `N`（0・負数・非整数）はリテラル扱いです。

---

## 11. Page Break 「改ページ」

*New in 2.0.*

Forces a page break in paginated output (EPUB / PDF / DOCX). Continuous media (web) may render it as extra vertical space or ignore it.  
ページ概念のある出力（EPUB / PDF / DOCX）で改ページを強制します。Web などの連続メディアでは余白として描画するか無視します。

### Syntax / 構文

Written on its own line, as a block.  
単独の行にブロックとして書きます。

```
[[pagebreak]]         ... 改ページ
[[pagebreak:right]]   ... 改丁 — next page must be a right-hand page (recto)
[[pagebreak:left]]    ... 改丁 — next page must be a left-hand page (verso)
```

### Examples / 例

```markdown
第一章はここで終わる。

[[pagebreak]]

第二章が始まる。
```

### HTML Output / HTML 出力

```html
<div class="mdi-pagebreak" role="presentation"></div>
<div class="mdi-pagebreak mdi-pagebreak-right" role="presentation"></div>
<div class="mdi-pagebreak mdi-pagebreak-left" role="presentation"></div>
```

```css
.mdi-pagebreak       { break-after: page; }
.mdi-pagebreak-right { break-after: recto; }
.mdi-pagebreak-left  { break-after: verso; }
```

`recto` / `verso` have limited CSS support; EPUB and DOCX exporters map 改丁 to the format's native page-break properties.  
`recto` / `verso` の CSS サポートは限定的です。EPUB・DOCX エクスポータでは各形式のネイティブな改ページ属性にマップします。

**Notes / 注意事項:**

- A `[[pagebreak]]` line is always a **block boundary**, like the blank-paragraph `\` line (§7): it terminates the current paragraph even without a preceding blank line.  
  `[[pagebreak]]` の行は、空白段落の `\` 行（第7節）と同様、常に**ブロック境界**です。直前に空行がなくても、その時点で段落は終了します。

---

## 12. Footnotes 「脚注」

*New in 2.0.*

MDI **inherits** the GFM / Pandoc footnote syntax — no MDI-specific notation is introduced.  
脚注は GFM / Pandoc の記法を**そのまま継承**します。MDI 固有の記法は導入しません。

### Syntax / 構文

```markdown
彼はその話を信じなかった[^1]。

[^1]: 後に事実と判明する。
```

### Rendering / 描画

| Context | Behavior |
|---------|----------|
| Horizontal writing 横書き | Footnotes collected at the end of the document (endnotes) / 文書末にまとめて配置 |
| Vertical writing 縦書き | Same — rendered as endnotes; renderers **may** offer 傍注 (margin notes) as an option / 同じく文書末。レンダラーはオプションで傍注に対応してもよい |
| EPUB export | `epub:type="footnote"` pop-up footnotes / ポップアップ脚注 |

### HTML Output / HTML 出力

```html
彼はその話を信じなかった<sup class="mdi-fnref"><a href="#fn1" id="fnref1">1</a></sup>。
...
<section class="mdi-footnotes">
  <ol>
    <li id="fn1">後に事実と判明する。<a href="#fnref1">↩</a></li>
  </ol>
</section>
```

---

## 13. Escapes 「エスケープ」

Prepend `\` to write MDI delimiter characters as literal text.  
MDI の区切り文字をリテラルとして書くには `\` を前置します。

| Escape | Literal |
|--------|---------|
| `\{` | `{` |
| `\}` | `}` |
| `\|` | `|` |
| `\^` | `^` |
| `\[` | `[` |
| `\]` | `]` |
| `\:` | `:` |
| `\《` | `《` |
| `\》` | `》` |

**Normative in 2.0:** escape processing runs **once, first**, before any MDI inline parsing, and behaves identically through every API and renderer. An escaped character never participates in any MDI delimiter match.
**2.0 での規範:** エスケープ処理はすべての MDI インライン解析に**先立って一度だけ**実行され、すべての API とレンダラーで同一に動作します。エスケープされた文字はいかなる MDI 区切り文字のマッチにも参加しません。

**Exception — GFM table cells:** inside a table cell, `\|` is consumed by **GFM's own table parsing** at the block stage (it is the cell-separator escape), which runs before MDI escape processing. The `|` it produces is an ordinary character and **does** participate in MDI inline matching — this is what makes `{東京\|とうきょう}` in a cell produce normal ruby (see §2). Consequently, a *literal* `|` inside ruby syntax within a table cell is not expressible; move such content out of the table or restructure the ruby.  
**例外 — GFM 表セル:** 表のセル内の `\|` は、MDI エスケープ処理より前のブロック段階で **GFM 自身の表解析**が消費します（セル区切りのエスケープ）。その結果生じる `|` は通常の文字であり、MDI インライン解析に**参加します** — セル内の `{東京\|とうきょう}` が通常のルビになるのはこのためです（第2節参照）。この帰結として、表セル内のルビ構文の中に*リテラルの* `|` を書くことはできません。その場合は表の外に出すか、ルビの構成を変えてください。

---

## 14. Quick Reference / クイックリファレンス

| Feature | Syntax | Example |
|---------|--------|---------|
| **Ruby (group)** ルビ（グループ） | `{base\|ruby}` | `{東京\|とうきょう}` |
| **Ruby (split)** ルビ（分割） | `{base\|r.u.by}` | `{東京\|とう.きょう}` |
| **Tate-chu-yoko** 縦中横 | `^text^` | `第^12^話` |
| **Boten** 傍点 | `[[em:text]]` / `[[em:<mark>:text]]` | `[[em:それ]]` |
| **No-break** 改行抑止 | `[[no-break:text]]` | `[[no-break:新宿区]]` |
| **Line break** 改行 | `[[br]]` | `曙。[[br]]やうやう` |
| **Paragraph break** 換段 | blank line | `（空行）` |
| **Blank paragraph** 空白段落 | `\` (own line) | `\` |
| **Warichu** 割注 | `[[warichu:text]]` | `[[warichu:注記]]` |
| **Kerning** 字間調整 | `[[kern:<amount>:text]]` | `[[kern:-0.1em:言葉]]` |
| **Indent** 字下げ | `[[indent:N]]` | `[[indent:2]]` |
| **Bottom align** 地付き・字上げ | `[[bottom]]` / `[[bottom:N]]` | `[[bottom:2]]` |
| **Page break** 改ページ | `[[pagebreak]]` / `[[pagebreak:right\|left]]` | `[[pagebreak]]` |
| **Footnote** 脚注 | `[^id]` (GFM) | `[^1]` |

**Supported alternates / 互換記法** (always accepted; normalized to the recommended form on save / 常に受理され、保存時に推奨記法へ正規化):

| Alternate | Recommended form |
|-----------|------------------|
| `[[blank]]` | `\` (own line) |
| `<br>` alone on a line | `\` (own line) |
| `《《text》》` | `[[em:text]]` |

---

## CSS Class Summary / CSS クラス一覧

| Class | Feature |
|-------|---------|
| `.mdi-ruby` | Ruby base element |
| `.mdi-tcy` | Tate-chu-yoko |
| `.mdi-em` | Boten (uses `--mdi-em` CSS variable) |
| `.mdi-nobr` | No-break span |
| `br.mdi-break` | Explicit line break |
| `.mdi-blank` | Blank paragraph |
| `.mdi-warichu` | Warichu inline note |
| `.mdi-kern` | Kerning span (uses `--mdi-kern` CSS variable) |
| `.mdi-indent` | Indented block (uses `--mdi-indent`) |
| `.mdi-bottom` | Bottom-aligned block (uses `--mdi-shift`) |
| `.mdi-pagebreak` | Page break |
| `.mdi-fnref` / `.mdi-footnotes` | Footnote reference / footnote section |

---

## TXT Export Flavors / TXT 書き出しフレーバー

*New in 2.0.*

HTML/PDF/EPUB share one CSS-driven rendering model, but plain text has no styling layer — every MDI construct must be flattened to a specific textual convention, and more than one such convention is in real-world use. Conforming TXT exporters SHOULD support at least the following five flavors. Any MDI construct with no equivalent in a given flavor is flattened to its base text (macro dropped, content kept).  
HTML・PDF・EPUB は同じ CSS 駆動の描画モデルを共有しますが、プレーンテキストにはスタイル層がなく、MDI の各構成要素を具体的な文字表現へフラット化する必要があります。その表現の慣例は実務上一つではありません。**準拠する TXT エクスポータは、少なくとも以下 5 種類のフレーバーをサポートすることが望ましい（SHOULD）。** あるフレーバーに対応する慣例がない構成要素は、マクロを除去し中身のテキストのみを残します（フラット化）。

| Flavor | Purpose / 用途 |
|--------|----------------|
| `plain` | Simplest export: ruby discarded, every macro flattened to base text. / 最も単純な書き出し。ルビは破棄。 |
| `ruby-paren` | Ruby rendered as fullwidth parentheses: `漢字（かんじ）`. / ルビを全角括弧で表現。 |
| `narou` | 小説家になろう submission format. Ruby via `｜《》`; boten via per-character dot ruby (the site has no boten notation). / 小説家になろうの投稿フォーマット。ルビは `｜《》`、傍点はサイトに専用記法がないため一字ずつの圏点ルビで表現。 |
| `kakuyomu` | カクヨム submission format. Ruby via `｜《》`; boten via the site's native `《《》》` notation. / カクヨムの投稿フォーマット。ルビは `｜《》`、傍点はサイト固有の `《《》》` 記法。 |
| `aozora` | Aozora Bunko (青空文庫) annotation ("注記") convention. / 青空文庫注記形式。 |

The three platform flavors are contract-bound to the platform-owned documentation: [Narou ruby](https://syosetu.com/helpcenter/helppage/helppageid/42/), [Narou boten](https://syosetu.com/helpcenter/helppage/helppageid/43/), [Kakuyomu notation](https://kakuyomu.jp/help/entry/notation), and the [Aozora input manual](https://www.aozora.gr.jp/aozora-manual/index-input.html) plus [annotation list](https://www.aozora.gr.jp/annotation/). Consequently the two posting-site outputs also differ in limits and literal escaping, not only boten. Ruby outside a site's documented limits is flattened to readable base text rather than emitting an invalid tag.
三つのプラットフォーム向けフレーバーは、各公式文書（[なろうのルビ](https://syosetu.com/helpcenter/helppage/helppageid/42/)、[なろうの傍点](https://syosetu.com/helpcenter/helppage/helppageid/43/)、[カクヨム記法](https://kakuyomu.jp/help/entry/notation)、[青空文庫作業マニュアル](https://www.aozora.gr.jp/aozora-manual/index-input.html) と [注記一覧](https://www.aozora.gr.jp/annotation/)）を契約とします。そのため、投稿サイト向けの二形式は傍点だけでなく、字数上限とリテラルのエスケープも異なります。公式上限を超えるルビは、不正なタグを出力せず、読みやすい親文字へフラット化します。

### Mapping table / 対応表

| MDI | `plain` | `ruby-paren` | `narou` | `kakuyomu` | `aozora` |
|-----|---------|--------------|---------|------------|----------|
| `{東京\|とうきょう}` (group ruby) | `東京` | `東京（とうきょう）` | `｜東京《とうきょう》` (base/reading 1–10 characters; `&"<>` rejected) | `｜東京《とうきょう》` (base ≤20, reading ≤50) | `｜東京《とうきょう》` |
| `{東京\|とう.きょう}` (split ruby) | `東京` | `東京（とうきょう）` (dots removed) | `｜東京《とうきょう》` | same notation, with Kakuyomu limits | `｜東京《とうきょう》` |
| `^12^` (tate-chu-yoko) | `12` | `12` | `12` (no convention; flattened) | same as narou | `12［＃「12」は縦中横］` |
| `[[em:それ]]` (boten, default mark) | `それ` | `それ` | `｜そ《・》｜れ《・》` (per-character valid ruby; `<mark>` dropped) | `《《それ》》` (native Kakuyomu notation; `<mark>` dropped) | `［＃傍点］それ［＃傍点終わり］` (recognized marks map to official names, e.g. `●`→`丸傍点`, `﹆`→`白ゴマ傍点`) |
| `[[no-break:...]]` | text kept, macro dropped | same | same | same | same (no aozora equivalent) |
| `[[br]]` | `\n` | `\n` | `\n` | `\n` | `\n` |
| `\` (blank paragraph) | blank line | blank line | blank line | blank line | blank line |
| `[[warichu:text]]` | text kept, macro dropped | same | same (no convention) | same | `［＃割り注］text［＃割り注終わり］` (aozora's native two-line-note construct) |
| `[[kern:<amount>:text]]` | text kept, macro dropped | same | same | same | same (no aozora equivalent — kerning is a rendering-only concern) |
| `[[indent:N]]` | implementation-defined | same | N ideographic spaces | same | `［＃Ｎ字下げ］` (fullwidth digits, official one-line form) |
| `[[bottom]]` / `[[bottom:N]]` | implementation-defined | same | same (no convention) | same | `［＃地付き］` / `［＃地からＮ字上げ］` |
| `[[pagebreak]]` / `:left` / `:right` | blank line or dropped (implementation-defined) | same | same (no convention) | same | `［＃改ページ］` / `［＃改丁］` / `［＃改見開き］` |
| Markdown headings | text kept | same | same | same | official 大／中／小 hierarchy; a fourth distinct level is left unannotated and adds the required note at file end |
| `[^id]` (footnote) | implementation-defined (e.g. inline number + note appended at document end) | same | same | same | same |

Literal platform delimiters are protected according to the same contracts: Kakuyomu `《` becomes `｜《`; Narou parenthesized prose gets the documented leading vertical bar so it is not mistaken for shorthand ruby; and Aozora's nine reserved characters are emitted with the official external-character annotations. The CLI writes Aozora files as Shift_JIS with CRLF and rejects characters outside that repertoire instead of silently replacing them with `?`.
プラットフォームの区切り記号を本文として書く場合も、同じ公式契約に従います。カクヨムの `《` は `｜《`、なろうの括弧書きは簡易ルビと誤認されないよう公式どおり直前に縦線を置き、青空文庫の予約済み9文字は公式の外字注記へ変換します。CLI の青空文庫ファイルは Shift_JIS・CRLF で、範囲外文字を `?` に黙って置換せずエラーにします。

Implementations MAY offer additional flavors beyond these five; they are the minimum interoperability baseline so that `.mdi → txt` conversions stay predictable across tools.  
実装はこれ以外のフレーバーを追加してもよい（MAY）。上記 5 種類は、`.mdi → txt` の変換がツール間で予測可能であるための最小限の相互運用ベースラインです。

---

## Parsing Order / パース順序

Implementations should process MDI syntax in the following order:  
実装では、以下の順序で MDI 構文を処理することを推奨します。

**Block stage / ブロック段階:**

1. Front matter / フロントマター
2. Standard Markdown block structure (paragraphs, code blocks, blockquotes, thematic breaks…) / 標準 Markdown のブロック構造
3. Blank paragraph lines: `\`, `<br>`, `[[blank]]`
4. Block macros: `[[pagebreak]]`, `[[indent:N]]`, `[[bottom]]`, `[[bottom:N]]`

**Inline stage / インライン段階 (inside each paragraph):**

5. Escape processing / エスケープ処理
6. Ruby: `{base|ruby}`
7. Boten alias: `《《...》》`
8. Tate-chu-yoko: `^...^`
9. Bracket macros: `[[br]]`, `[[no-break:...]]`, `[[em:...]]`, `[[warichu:...]]`, `[[kern:...:...]]`
10. Footnote references: `[^id]`

### Inline Nesting / インラインの入れ子

*Normative in 2.0.*

- **Bracket macro content is MDI inline content.** The content of `[[em:...]]`, `[[no-break:...]]`, `[[warichu:...]]`, and `[[kern:...:...]]` is parsed as MDI inline syntax — ruby, tate-chu-yoko, and other bracket macros may appear inside. `[[em:{東京|とうきょう}]]` places boten on ruby-annotated text.  
  **ブラケットマクロの内容は MDI インライン内容です。** `[[em:...]]`・`[[no-break:...]]`・`[[warichu:...]]`・`[[kern:...:...]]` の内容は MDI インライン構文として解析され、ルビ・縦中横・他のブラケットマクロを含められます。`[[em:{東京|とうきょう}]]` はルビ付きテキストに傍点を打ちます。
- **Closing is balanced.** A bracket macro closes at its *matching* `]]`: `[[` / `]]` pairs nest by counting, and escaped brackets (`\[`, `\]`) do not participate. In `[[em:foo[[no-break:bar]]baz]]`, the first `]]` closes `no-break`, the second closes `em`.  
  **閉じ括弧は対応で決まる。** ブラケットマクロは*対応する* `]]` で閉じます。`[[` / `]]` の対はカウントで入れ子になり、エスケープされた括弧（`\[` `\]`）はカウントに参加しません。`[[em:foo[[no-break:bar]]baz]]` では最初の `]]` が `no-break` を、次の `]]` が `em` を閉じます。
- **Ruby, tate-chu-yoko, and `《《...》》` content is plain text.** No MDI construct is recognized inside `{...|...}` (both base and reading), `^...^` (whose charset forbids it by construction), or `《《...》》`.  
  **ルビ・縦中横・`《《...》》` の内容はプレーンテキストです。** `{...|...}`（親文字・ルビとも）、`^...^`（文字種制限により構造上不可能）、`《《...》》` の内部では MDI 構文を認識しません。
- **Rendering nests naturally.** HTML output nests the corresponding elements (e.g. `<span class="mdi-em" …><ruby class="mdi-ruby">…</ruby></span>`). When boten wraps ruby, the stylesheet must suppress emphasis marks on the reading:  
  **描画は自然に入れ子になります。** HTML 出力は対応する要素をそのまま入れ子にします。傍点がルビを包む場合、ルビ文字（`<rt>`）への傍点の重複をスタイルシートで抑止します:

  ```css
  .mdi-em rt { text-emphasis: none; }
  ```

---

*MDI 2.0 Draft — MDI 1.0 is preserved on the [`spec/v1.0`](../../tree/spec/v1.0) branch. Aozora Bunko notation interop ships in 2.0 as an export-side convention (see [TXT Export Flavors](#txt-export-flavors--txt-書き出しフレーバー)); parse-side Aozora notation interop (e.g. reading `｜base《ruby》` as input) remains planned for a future revision.*
