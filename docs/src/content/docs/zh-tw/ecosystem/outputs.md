---
title: HTML / TXT / EPUB / DOCX / PDF 輸出
description: 每個輸出格式的含義、rendering package 與 layout responsibility。
---

**先備知識：**[轉譯模型與 Chromium/PDF 邊界](/zh-tw/core/rendering/)。

下列每個輸出都是**同一份** MDI document IR 的轉換，見 [Document IR](/zh-tw/core/document-ir/)；它們都不是第二層 syntax，也不重新決定 source text 的含義。本頁從 package boundary 檢視，renderer internals 請見[轉譯模型](/zh-tw/core/rendering/)。

| Format | Package | 實際內容 |
| --- | --- | --- |
| HTML | `@illusions-lab/mdi`（`renderHtml`） | standalone HTML document 加 embedded `.mdi-*` stylesheet |
| TXT（6 flavors） | `@illusions-lab/mdi`（`renderTextFormat`）/ CLI | plain、保留 ruby 或特定日文出版平台的 plain-text convention；包含 [note 匯出](/zh-tw/ecosystem/note/) |
| EPUB | `@illusions-lab/mdi`（`renderEpub`） | 真正 EPUB 3 archive：reflowable XHTML chapters + `nav.xhtml` + CSS + OPF package，由 Rust zip |
| DOCX | `@illusions-lab/mdi`（`renderDocx`） | 真正 OOXML（WordprocessingML）文件，由 Rust zip |
| PDF | `@illusions-lab/mdi-to-pdf` | Rust-rendered HTML/print CSS，由本機 Chromium-family browser layout/rasterize |

五種中四種完全在 Rust 內產生，包含套用 profile 的 EPUB/DOCX。CLI 與 JavaScript package 只整理 arguments，不含中間 JavaScript renderer。PDF 使用 Rust 解決的 profile 與準備完成的 HTML/print CSS，再由 native 或 Node host 啟動 Chromium。

## Legacy compatibility packages

`@illusions-lab/mdi-to-hast`、`mdi-to-html`、`mdi-to-epub`、`mdi-to-docx` 仍發布，供已持有 `mdast`/HAST tree 的 unified consumer 使用。EPUB/DOCX compatibility entry 會把 tree serialize 為 MDI，再交給 Rust 完成輸出；JavaScript 不再保留獨立 archive generator。**CLI 不使用這些 tree-facing entry**。重要差異是 `mdi-to-hast` stylesheet 比 Rust `render_html` embedded CSS 更接近 `SYNTAX.md`，見[stylesheet parity](/zh-tw/ecosystem/compatibility/#stylesheet-parity)。

## 設定型輸出

設定型 EPUB 支援 metadata、writing mode、typography、chapter split 與
PNG/JPEG cover。設定型 DOCX 支援 metadata、page geometry、mirror margin、
writing mode、typography、strict／flowing grid 和頁碼。兩條路徑都在 Rust
解析同一份 [export profile](/zh-tw/ecosystem/export-profiles/)，因此未來
Python、Swift 或 Android API 可以直接公開同樣的能力，不必重寫邏輯。

## 下一步

- [轉譯模型](/zh-tw/core/rendering/)
- [Export profiles](/zh-tw/ecosystem/export-profiles/)
- [Migration 與 compatibility](/zh-tw/ecosystem/compatibility/)
