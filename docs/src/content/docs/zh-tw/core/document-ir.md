---
title: Document IR
description: 每個 MDI renderer 與 binding 消費的精確、已版本化 tree，含真實 JSON。
---

**先備知識：**[核心概念](/zh-tw/learn/core-concepts/#2-文件-ir中間表示法)。

## 外層

任何 binding 的 `parse()` 都回傳下列形狀。目前 `irVersion` 為 `"1.0"`，`syntaxVersion` 為 `"2.0"`；兩者獨立，理由請見[核心概念](/zh-tw/learn/core-concepts/#2-文件-ir中間表示法)。

```json
{"irVersion":"1.0","syntaxVersion":"2.0","capabilities":{"mdi":true,"commonMark":true,"gfm":true,"frontMatter":true,"sourceSpans":true},"document":{"span":{"startByte":0,"endByte":0},"children":[]},"diagnostics":[]}
```

每個 capability 目前都是 `true`：`mdi-core` 一趟解析完整文件並為每個 node 保留 source span。仍應在自己的程式中檢查 `capabilities`，不要寫死假設；欄位存在的目的就是讓 consumer 不必猜測，舊或未來的結果可合理地有 `false`。

## `Document`

```ts
interface MdiDocument { span: MdiSourceSpan; frontmatter?: MdiFrontmatter; children: MdiNode[]; }
interface MdiFrontmatter { span: MdiSourceSpan; raw: string; entries: Array<{ key: string; value: unknown }>; }
```

`frontmatter` 是 `children` 的**同層 sibling**，不是其內 node；它是文件 metadata，不是內容，因此走訪可見文件的 `children` 時不會出現。

## `MdiNode` 目錄

每個 node 有 `type`，source-backed node 有 `span`；container node 有 `children`。

一般 Markdown node（CommonMark/GFM，未被 MDI 修改）是：`paragraph`、`heading`（`depth: 1–6`）、`blockquote`、`list`/`listItem`（`ordered`、`start`）、`code`、`inlineCode`、`thematicBreak`、`html`、`table`/`tableRow`/`tableCell`、`link`、`image`、`emphasis`、`strong`、`delete`、`text`、`footnoteReference`、`footnoteDefinition`。

| `type` | 額外欄位 | 產生方式 |
| --- | --- | --- |
| `ruby` | `base: string`, `ruby: MdiRubyReading` | `{base\|reading}` |
| `tcy` | `value: string` | `^text^` |
| `break` | — | `[[br]]` |
| `em` | `mark: string`, `children` | `[[em:text]]`、`[[em:<mark>:text]]`、`《《text》》` |
| `noBreak` | `children` | `[[no-break:text]]` |
| `warichu` | `children` | `[[warichu:text]]` |
| `kern` | `amount: string`, `children` | `[[kern:<amount>:text]]` |
| `blank` | — | 單獨的 `\` 行、`<br>` 或 `[[blank]]` |
| `pagebreak` | `variant: "left" \| "right" \| null` | `[[pagebreak]]`、`[[pagebreak:left\|right]]` |
| 帶 `indent` 或 `bottom` 的 `paragraph` | `indent?: number`, `bottom?: number` | `[[indent:N]]` / `[[bottom]]` / `[[bottom:N]]` 套用至下一段 |

```ts
type MdiRubyReading = { type: "group"; value: string } | { type: "split"; value: string[] };
```

範例 `{雪女|ゆき.おんな}`：

```json
{"type":"ruby","base":"雪女","ruby":{"type":"split","value":["ゆき","おんな"]},"span":{"startByte":0,"endByte":12}}
```

## Spans

`span.startByte` / `span.endByte` 是傳給 `parse()` 的原始字串中 half-open UTF-8 **byte** range。請見[診斷與 UTF-8 source spans](/zh-tw/core/diagnostics/)，了解原因與如何轉為宿主語言字串索引。

## 過渡期的 `MdiSyntaxDocument` 形狀

還有第二種較舊、簡單得多的 tree，僅由已 deprecated 的 `parse_mdi_syntax` / `parseMdiSyntax` 相容路徑產生：

```ts
interface MdiSyntaxDocument { blocks: Array<{ type: "paragraph"; inlines: MdiInline[]; indent: number | null; bottom: number | null } | { type: "blank" } | { type: "pagebreak"; variant: "left" | "right" | null }>; }
```

它沒有 spans、front matter 或一般 Markdown node，只認得 MDI 專用 inline/block construct，其他文字當成不透明 paragraph。它早於完整 CommonMark/GFM/MDI parser，今日只為避免舊 caller 壞掉；新程式一律使用 `parse()`/`parse_document()` 回傳的上方 `Document`。看到回傳 `MdiSyntaxDocument` 即表示走了 deprecated 路徑，勿與兩者混淆。

## 下一步

- [診斷與 UTF-8 source spans](/zh-tw/core/diagnostics/)
- [Rust Core API 狀態](/zh-tw/core/rust-api/)
- [完整 syntax reference](/zh-tw/syntax/reference/)
