---
title: 以 Rust 為唯一權威的架構
description: 一個可執行的文法、一個已版本化的 IR，以及薄薄的宿主語言介面。
---

**先備知識：**[核心概念](/zh-tw/learn/core-concepts/)。

## 規則

**除了 `mdi-core`，任何綁定、轉接器、編輯器或轉譯器都不得保存第二份 MDI 文法。** 不可以有重複的 tokenizer、WASM 未載入時的「備援」正則表達式，也不可以各語言手動維護一套所謂同步的重作。若兩個工具把同一份 `.mdi` 解析得不同，依定義其中一個就是錯的：只有一處能決定語意。

這比「Rust 是參考實作」更嚴格。其他工具可以重作並隨時間漂移的參考實作並不夠；MDI 的契約是其他工具必須**呼叫**唯一實作，或重塑它的輸出，絕不能複製它的決定。

## 兩種互補的權威

1. [`SYNTAX.md`](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md) — 可供人閱讀的規範，說明規則為何存在。
2. `mdi-core` — 該規範唯一可執行的實作，也就是實際執行者。
3. 共用的相容性 fixtures（各綁定以相同方式執行 parser、diagnostic 與 renderer 測試）是兩者間可觀察的相容性契約，讓「符合規範」可以執行驗證。

## 系統形狀

```text
                               .mdi source
                                    │
                                    ▼
                    ┌─────────────────────────────┐
                    │ mdi-core (Rust)             │
                    │ CommonMark + GFM + MDI      │
                    │ + front matter + diagnostics│
                    └──────────────┬──────────────┘
                                   │
                         versioned MDI document IR
                                   │
             ┌─────────────────────┼──────────────────────┐
             │                     │                      │
             ▼                     ▼                      ▼
      Rust renderers        language bindings      ecosystem adapters
      HTML/TXT/EPUB/DOCX/MDI  Node.js (real)         mdast/remark (real)
                              Python / Swift (real)
                              Android / Kotlin (development)
             │
             └── HTML + print CSS ──▶ Chromium ──▶ PDF
```

以上已發布的關係今天都可驗證。Rust、Node.js、Swift 與 Python 都呼叫同一份 Rust 程式碼。Android / Kotlin 仍在開發中，尚未在 Maven Central 提供公開穩定套件；請見 [Bindings](/zh-tw/bindings/javascript/) 的各平台細節。

## 為何是一趟，而非每層各一趟

MDI 不能在另一棵已解析 Markdown tree 上疊一層獨立解析，因為 MDI 邊界仰賴只有合併 parser 才看得到的 Markdown context：

```markdown
`^12^`                 <!-- code span 中：字面文字，不是直排橫排 -->
**第^12^話**            <!-- strong emphasis 中：直排橫排仍生效 -->
[[em:**重要**]]        <!-- MDI macro 中巢狀 Markdown emphasis -->
```

兩趟設計必須重推這些邊界，容易在這些例子的邊緣情況與單趟 Rust parser 不一致。`mdi-core` 在一趟中解析 CommonMark、GFM、front matter 與 MDI，產出一棵 tree。

## 綁定可做的事

綁定可以在 Rust wire format 與宿主語言慣用形式間轉換字串、位元組、錯誤、選項與物件形狀；不得加入自己的文法表、tokenizer、字面備援規則或 renderer 語意。具體而言，`@illusions-lab/mdi` 的 `parse()` 是薄包裝：呼叫編譯成 WASM 的 Rust parser、檢查 IR version，然後回傳結果；[約 140 行的實際原始碼](https://github.com/illusions-lab/MDI/blob/main/nodejs/packages/mdi/src/index.ts)沒有任何 MDI 特有決策。

## 合規檢查表

- 每個 syntax entry point 都將完整來源交給 `mdi-core`。
- 所有公開 parse 結果都宣告 syntax 與 IR version。
- 每個綁定原封不動通過共用 parse 與 diagnostic fixtures。
- 每個 deterministic renderer 都消費 Rust IR，絕不重新讀取來源文字。
- PDF 使用 Rust IR 產生的 HTML/CSS，由 Rust 協調。
- 任何宿主語言 package 都不含替代 MDI tokenizer 或 parser。

## 目前實作狀態

| 層 | 狀態 |
| --- | --- |
| `mdi-core`：一次 Rust parse 完整處理 CommonMark + GFM + front matter + MDI | **已實作。**請見 [Rust Core API](/zh-tw/core/rust-api/)。 |
| Rust 原生 `renderHtml`/`renderText`/`renderEpub`/`renderDocx` | **已實作。**Baseline 與設定型 EPUB/DOCX 共用同一組 Rust renderer；cover、分章、typography、page geometry 與頁碼目前都可使用。 |
| Rust 協調 Chromium 的 PDF | **已實作。**請見[轉譯模型](/zh-tw/core/rendering/#chromiumpdf-邊界)。 |
| `@illusions-lab/mdi`（JavaScript/WASM） | **已實作**，每項操作直接呼叫 Rust。 |
| `@illusions-lab/mdi-remark`（mdast adapter） | **已實作**，但僅單向 MDI → mdast。 |
| `@illusions-lab/mdi-cli` | **已實作**，除最後 Chromium print 外每格式皆直接呼叫 Rust。 |
| Python binding（PyO3） | **已實作。**PyPI 套件為 [`illusion-markdown`](https://pypi.org/project/illusion-markdown/)（import 名稱 `mdi`）。 |
| Swift binding | **已實作。**見 [Swift](/zh-tw/bindings/swift/)。 |
| Android / Kotlin binding | **開發中。**已有 source 與本機驗證方式，但尚未在 Maven Central 提供公開穩定套件。見 [Android / Kotlin](/zh-tw/bindings/android/)。 |

儲存庫的 [`ARCHITECTURE.md`](https://github.com/illusions-lab/MDI/blob/main/ARCHITECTURE.md) 是此契約的規範版本；本頁負責解釋與核對狀態。

## 下一步

- [Document IR](/zh-tw/core/document-ir/)
- [Rust Core API 狀態](/zh-tw/core/rust-api/)
- [轉譯模型與 Chromium/PDF 邊界](/zh-tw/core/rendering/)
