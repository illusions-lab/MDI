---
title: 架構
description: mdi-js 九個套件如何組合，以及管線為什麼在這些位置切分。
---

## 套件分層

| 套件 | 層 | 職責 |
|---------|-------|------|
| `micromark-extension-mdi` | 解析核心 | 在 CommonMark 之上 tokenize MDI 的行內/區塊語法。 |
| `mdast-util-mdi` | 解析核心 | 把 token 事件編譯成 mdast 節點，並能序列化回 markdown。 |
| `@illusions-lab/mdi-remark` | 解析核心 | 單一 remark 插件，打包 GFM + YAML front matter + MDI 擴充。建議的入口。 |
| `@illusions-lab/mdi-to-hast` | 共享轉換 | 按規範的 HTML 映射把 MDI mdast 節點轉成 hast。匯出 handler 表（`mdiHandlers`）和樣式表。 |
| `@illusions-lab/mdi-to-html` | 轉換器 | hast → 完整 HTML 文件字串，樣式表內嵌。 |
| `@illusions-lab/mdi-to-pdf` | 轉換器 | 用無頭 Chromium 渲染 HTML 並列印成 PDF。 |
| `@illusions-lab/mdi-to-epub` | 轉換器 | hast → EPUB 3（XHTML、OPF manifest、nav；按分頁切分 spine）。 |
| `@illusions-lab/mdi-to-docx` | 轉換器 | mdast → 原生 OOXML，完全繞過 hast。 |
| `@illusions-lab/mdi-cli` | CLI | `mdi build input.mdi --to html\|pdf\|epub\|docx` — 轉換器的薄封裝。 |

## 管線

```
micromark-extension-mdi ─▶ mdast-util-mdi ─▶ @illusions-lab/mdi-remark
                                  │
                                  ▼  (同一棵 mdast 樹)
                        @illusions-lab/mdi-to-hast ────────┐
                            │              │               │
                            ▼              ▼               │
                       mdi-to-html    mdi-to-epub          │
                            │                              │
                            ▼                              ▼
                       mdi-to-pdf                    mdi-to-docx
                                              (直接讀 mdast)
```

所有轉換器消費 `@illusions-lab/mdi-remark` 產生的**同一棵 mdast 樹**，
所以編輯器路徑與匯出路徑的行為保持同步（見規範的
[解析順序](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md#parsing-order--パース順序)）。

## 為什麼在這些位置切分

**四種輸出格式有三種是 HTML 家族。** HTML、PDF（從瀏覽器列印）、EPUB
（打包的 XHTML）需要同一套 mdast → hast 映射，所以這套映射只在
`@illusions-lab/mdi-to-hast` 實作一次，三個轉換器保持很薄。

**PDF 刻意走真瀏覽器。** 日文排版功能 — `writing-mode: vertical-rl`、
`text-combine-upright`（縦中横）、`text-emphasis`（傍點）— 正是輕量
HTML 轉 PDF 函式庫會弄錯的那些 CSS。無頭 Chromium 渲染正確，所以
`mdi-to-pdf` 就是刻意的「打開 HTML，列印」。

**DOCX 不是 HTML 家族。** Word 對同樣的概念有原生結構（`<w:ruby>`、
`<w:eastAsianLayout w:combine="1"/>`、section 層級的直書方向），如果從
hast 映射，等於把本來就有的語義先攤平成 HTML 再挖回來。所以
`mdi-to-docx` 直接讀 mdast 樹。

**解析核心是三個套件而不是一個**，是遵循 micromark/mdast 生態的慣例：
tokenizer 和 mdast 工具可以單獨用在任何 unified 管線裡（本文檔網站正是
只用了這兩個加 `mdiHandlers`，完全沒用轉換器）；而
`@illusions-lab/mdi-remark` 是給應用程式的全配插件。

## Rust 語法核心與 JavaScript-first 發布

MDI 的權威語法由獨立的
[`illusions-lab/MDI`](https://github.com/illusions-lab/MDI) 規範倉庫管理。
本倉庫維持既有的 `mdi-js` 名稱與 JavaScript 公開 API。

`crates/mdi-core` 是語言中立的 Rust 實作，處理 escape、以 grapheme cluster
為單位的 ruby、縦中横、傍點、可巢狀的行內 macro 與區塊 macro。它刻意**不**
解析 CommonMark 或 GFM；這些仍由 JavaScript adapter 中的 micromark/remark
處理。因此既有 mdast API 和所有 JS 使用者的行為都能維持不變。

包含 Rust core 的第一個發布採 JavaScript-first：Cargo 驗證會和既有的
JavaScript test suite 一起跑，但公開 API 仍是目前的 micromark/remark pipeline。
未來的 native Node、Python 與 WASM binding 都會是同一核心的 adapter，而不是
各自重新實作一套 parser。

## 版本策略

套件版本是 `<MDI 規範版本>.<發佈次數>` — major.minor 永遠等於對應的
MDI 規範版本（目前 **2.0**），patch 是各套件自己的發佈計數，從 `.1`
開始。所以 `2.0.5` 的意思是「對應 MDI 2.0 的第 5 次發佈」，patch
在套件之間不同步。
