---
title: Document IR
description: すべての renderer と binding が読む、バージョン付きの文書木。
---

**前提:** [コア概念](/ja/learn/core-concepts/)。

## Envelope

`parse()` は次を返します。`irVersion` は `"1.0"`、`syntaxVersion` は `"2.0"` で、独立したバージョンです。

```json
{"irVersion":"1.0","syntaxVersion":"2.0","capabilities":{"mdi":true,"commonMark":true,"gfm":true,"frontMatter":true,"sourceSpans":true},"document":{"span":{"startByte":0,"endByte":0},"children":[]},"diagnostics":[]}
```

現在 capability はすべて `true` です。`mdi-core` は CommonMark、GFM、front matter、MDI を一回で解析し、すべての source-backed node に span を付けます。それでも consumer は値を固定せず確認してください。この field は古い結果や将来の結果を推測しないために存在します。

## `Document`

```ts
interface MdiDocument { span: MdiSourceSpan; frontmatter?: MdiFrontmatter; children: MdiNode[] }
interface MdiFrontmatter { span: MdiSourceSpan; raw: string; entries: Array<{ key: string; value: unknown }> }
```

`frontmatter` は `children` 内の node ではなく sibling です。可視コンテンツを走査する際には含まれません。`raw` は YAML block の正確な source text、`entries` は順序を保持し unknown key も含みます。

## Node 一覧

すべての node は `type` と（source-backed node では）`span` を持ち、container node は `children` を持ちます。通常の CommonMark/GFM node は `paragraph`、`heading`（`depth: 1–6`）、`blockquote`、`list`/`listItem`、`code`、`inlineCode`、`thematicBreak`、`html`、`table`/`tableRow`/`tableCell`、`link`、`image`、`emphasis`、`strong`、`delete`、`text`、footnote などです。

| `type` | 追加 field | 記法 |
| --- | --- | --- |
| `ruby` | `base`, `ruby` | `{base\|reading}` |
| `tcy` | `value` | `^text^` |
| `break` | — | `[[br]]` |
| `em` | `mark`, `children` | `[[em:text]]` / `《《text》》` |
| `noBreak` | `children` | `[[no-break:text]]` |
| `warichu` | `children` | `[[warichu:text]]` |
| `kern` | `amount`, `children` | `[[kern:<amount>:text]]` |
| `blank` | — | lone `\` line、`<br>`、`[[blank]]` |
| `pagebreak` | `variant: "left" \| "right" \| null` | `[[pagebreak]]` / `[[pagebreak:left\|right]]` |
| `paragraph` | `indent?`, `bottom?` | 次の paragraph に対する `[[indent:N]]` / `[[bottom]]` / `[[bottom:N]]` |

```ts
type MdiRubyReading = { type: "group"; value: string } | { type: "split"; value: string[] };
```

`{雪女|ゆき.おんな}` は `base: "雪女"` と `ruby: { type: "split", value: ["ゆき", "おんな"] }` の `ruby` node になります。span は source 全体の UTF-8 byte range を指します。

## Span

`startByte` / `endByte` は元ソースへの半開 UTF-8 byte range です。host 言語の文字 index に変換する方法は [Diagnostic](/ja/core/diagnostics/) を参照してください。

## 旧 `MdiSyntaxDocument`

deprecated な `parse_mdi_syntax` / `parseMdiSyntax` は別の、より単純な形を返します。

```ts
interface MdiSyntaxDocument { blocks: Array<{ type: "paragraph"; inlines: MdiInline[]; indent: number | null; bottom: number | null } | { type: "blank" } | { type: "pagebreak"; variant: "left" | "right" | null }> }
```

これは span、front matter、通常 Markdown node を持たず、MDI 構文だけを扱う互換用 API です。完全な CommonMark/GFM/MDI parser より前のもので、その他を opaque paragraph text として扱います。新規コードは `parse()` / `parse_document()` の `Document` を使ってください。`MdiSyntaxDocument` を返す function は deprecated path を使っている合図です。

## 次へ

- [Diagnostic](/ja/core/diagnostics/)
- [Rust Core API](/ja/core/rust-api/)
- [構文リファレンス](/ja/syntax/reference/)
