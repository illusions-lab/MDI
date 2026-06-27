# MDI Syntax Reference / MDI 構文リファレンス

> **illusion Markdown (`.mdi`)** extends standard Markdown with Japanese typography syntax.  
> All standard Markdown syntax (headings, lists, links, tables, etc.) is fully inherited — only MDI-specific extensions are documented here.
>
> **illusion Markdown (`.mdi`)** は標準 Markdown に日本語組版向けの拡張構文を加えたフォーマットです。  
> 見出し・リスト・リンク・表など標準 Markdown の記法はすべてそのまま使えます。このドキュメントでは **MDI 固有の拡張のみ** を解説します。

---

## Table of Contents / 目次

1. [Ruby 「ルビ」](#1-ruby-ルビ)
2. [Tate-chu-yoko 「縦中横」](#2-tate-chu-yoko-縦中横)
3. [No-break 「改行抑止」](#3-no-break-改行抑止)
4. [Explicit Line Break 「改行マーカー」](#4-explicit-line-break-改行マーカー)
5. [Blank Paragraph 「空白段落」](#5-blank-paragraph-空白段落)
6. [Kerning 「字間調整」](#6-kerning-字間調整)
7. [Escapes 「エスケープ」](#7-escapes-エスケープ)
8. [Quick Reference / クイックリファレンス](#8-quick-reference--クイックリファレンス)

---

## 1. Ruby 「ルビ」

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
<ruby class="mdi-ruby">東<rt>とう</rt>京<rt>きょう</rt></ruby>
```

**Group ruby:**
```html
<ruby class="mdi-ruby">東京<rt>とうきょう</rt></ruby>
```

---

## 2. Tate-chu-yoko 「縦中横」

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

---

## 3. No-break 「改行抑止」

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

## 4. Explicit Line Break 「改行マーカー」

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

## 5. Blank Paragraph 「空白段落」

`[[blank]]` is an **internal representation** used when saving an intentional empty paragraph — typically produced by pasting HTML or importing content that contains a bare `<br />`.

`[[blank]]` は、意図的な空白段落を保存するための**内部表現**です。通常は HTML 貼り付けやインポート時に自動生成されます。ユーザーが直接入力するケースはまれです。

### Syntax / 構文

```markdown
春は曙。

[[blank]]

夏は夜。
```

### Behavior / 挙動

| Context | Behavior |
|---------|----------|
| Editor | Rendered as an editable empty paragraph (`<p class="mdi-blank">`) |
| TXT export | Empty line |
| HTML export | `<p></p>` |
| DOCX export | Empty paragraph |

| コンテキスト | 挙動 |
|------------|------|
| エディタ | 編集可能な空段落 (`<p class="mdi-blank">`) として描画 |
| TXT 出力 | 空行 |
| HTML 出力 | `<p></p>` |
| DOCX 出力 | 空段落 |

**Notes / 注意事項:**
- `.mdi` files only.
- `[[blank]]` typed inside a fenced code block is converted on export (known limitation).
- `[[blank]]` inside a blockquote (`> ...`) is preserved as literal text.

---

## 6. Kerning 「字間調整」

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

## 7. Escapes 「エスケープ」

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

**Note:** Escape handling may differ between the editor (remark) path and the export path. Full escape support across all contexts is tracked on the roadmap.  
**注意:** エスケープの動作はエディタ (remark) 経路とエクスポート経路で差がある場合があります。全コンテキストでの完全対応はロードマップで追跡中です。

---

## 8. Quick Reference / クイックリファレンス

| Feature | Syntax | Example |
|---------|--------|---------|
| **Ruby (group)** ルビ（グループ） | `{base\|ruby}` | `{東京\|とうきょう}` |
| **Ruby (split)** ルビ（分割） | `{base\|r.u.by}` | `{東京\|とう.きょう}` |
| **Tate-chu-yoko** 縦中横 | `^text^` | `第^12^話` |
| **No-break** 改行抑止 | `[[no-break:text]]` | `[[no-break:新宿区]]` |
| **Line break** 改行 | `[[br]]` | `曙。[[br]]やうやう` |
| **Paragraph break** 換段 | blank line | `（空行）` |
| **Blank paragraph** 空白段落 | `[[blank]]` | `[[blank]]` |
| **Kerning** 字間調整 | `[[kern:<em>:text]]` | `[[kern:-0.1em:言葉]]` |

---

## CSS Class Summary / CSS クラス一覧

| Class | Feature |
|-------|---------|
| `.mdi-ruby` | Ruby base element |
| `.mdi-tcy` | Tate-chu-yoko |
| `.mdi-nobr` | No-break span |
| `br.mdi-break` | Explicit line break |
| `.mdi-blank` | Blank paragraph |
| `.mdi-kern` | Kerning span (uses `--mdi-kern` CSS variable) |

---

## Parsing Order / パース順序

Implementations should apply MDI inline parsing in the following order:  
実装では、以下の順序で MDI インライン構文を処理することを推奨します。

1. Escape processing / エスケープ処理
2. Ruby: `{base|ruby}`
3. Tate-chu-yoko: `^...^`
4. Bracket macros: `[[br]]`, `[[blank]]`, `[[no-break:...]]`, `[[kern:...:...]]`

---

*MDI 1.0 Draft — specification lives at [`docs/MDI/spec.md`](https://github.com/Iktahana/illusions/blob/main/docs/MDI/spec.md) in the illusions repository.*
