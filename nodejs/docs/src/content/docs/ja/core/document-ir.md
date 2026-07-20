---
title: Document IR
description: すべての renderer と binding が読む、バージョン付きの文書木。
---

**前提:** [コア概念](/ja/learn/core-concepts/#2-the-document-ir-intermediate-representation)。

## Envelope

`parse()` は次を返します。`irVersion` は `"1.0"`、`syntaxVersion` は `"2.0"` で、独立したバージョンです。

```json
{"irVersion":"1.0","syntaxVersion":"2.0","capabilities":{"mdi":true,"commonMark":true,"gfm":true,"frontMatter":true,"sourceSpans":true},"document":{"span":{"startByte":0,"endByte":0},"children":[]},"diagnostics":[]}
```

現在 capability はすべて `true` ですが、consumer は値を固定せず確認してください。

## `Document`

```ts
interface MdiDocument { span: MdiSourceSpan; frontmatter?: MdiFrontmatter; children: MdiNode[] }
interface MdiFrontmatter { span: MdiSourceSpan; raw: string; entries: Array<{ key: string; value: unknown }> }
```

`frontmatter` は `children` 内の node ではなく sibling です。可視コンテンツを走査する際には含まれません。

## Node 一覧

通常の CommonMark/GFM node は `paragraph`、`heading`、`blockquote`、`list`、`code`、`inlineCode`、`table`、`link`、`image`、`emphasis`、`strong`、`delete`、`text`、footnote などです。

| `type` | 追加 field | 記法 |
| --- | --- | --- |
| `ruby` | `base`, `ruby` | `{base\|reading}` |
| `tcy` | `value` | `^text^` |
| `break` | — | `[[br]]` |
| `em` | `mark`, `children` | `[[em:text]]` / `《《text》》` |
| `noBreak` / `warichu` | `children` | 各 macro |
| `kern` | `amount`, `children` | `[[kern:<amount>:text]]` |
| `blank` | — | lone `\` line、`<br>`、`[[blank]]` |
| `pagebreak` | `variant` | `[[pagebreak]]` |
| `paragraph` | `indent?`, `bottom?` | `[[indent:N]]` / `[[bottom]]` |

```ts
type MdiRubyReading = { type: "group"; value: string } | { type: "split"; value: string[] };
```

`{雪女|ゆき.おんな}` は `base: "雪女"` と `ruby: { type: "split", value: ["ゆき", "おんな"] }` の `ruby` node になります。

## Span

`startByte` / `endByte` は元ソースへの半開 UTF-8 byte range です。host 言語の文字 index に変換する方法は [Diagnostic](/ja/core/diagnostics/) を参照してください。

## 旧 `MdiSyntaxDocument`

deprecated な `parse_mdi_syntax` / `parseMdiSyntax` は別の、より単純な形を返します。

```ts
interface MdiSyntaxDocument { blocks: Array<{ type: "paragraph"; inlines: MdiInline[]; indent: number | null; bottom: number | null } | { type: "blank" } | { type: "pagebreak"; variant: "left" | "right" | null }> }
```

これは span、front matter、通常 Markdown node を持たず、MDI 構文だけを扱う互換用 API です。新規コードは `parse()` / `parse_document()` の `Document` を使ってください。

## 次へ

- [Diagnostic](/ja/core/diagnostics/)
- [Rust Core API](/ja/core/rust-api/)
- [構文リファレンス](/ja/syntax/reference/)
