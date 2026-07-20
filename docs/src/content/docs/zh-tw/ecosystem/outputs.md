---
title: HTML / TXT / EPUB / DOCX / PDF 輸出
description: 每個輸出格式的含義、rendering package 與 layout responsibility。
---

**先備知識：**[轉譯模型與 Chromium/PDF 邊界](/zh-tw/core/rendering/)。

下列每個輸出都是**同一份** MDI document IR 的轉換，見 [Document IR](/zh-tw/core/document-ir/)；它們都不是第二層 syntax，也不重新決定 source text 的含義。本頁從 package boundary 檢視，renderer internals 請見[轉譯模型](/zh-tw/core/rendering/)。

| Format | Package | 實際內容 |
| --- | --- | --- |
| HTML | `@illusions-lab/mdi`（`renderHtml`） | standalone HTML document 加 embedded `.mdi-*` stylesheet |
| TXT（5 flavors） | `@illusions-lab/mdi`（`renderTextFormat`）/ CLI | plain、保留 ruby 或特定日文出版平台的 plain-text convention；見[TXT export flavors](/zh-tw/syntax/reference/#txt-匯出風格) |
| EPUB | `@illusions-lab/mdi`（`renderEpub`） | 真正 EPUB 3 archive：reflowable XHTML chapters + `nav.xhtml` + CSS + OPF package，由 Rust zip |
| DOCX | `@illusions-lab/mdi`（`renderDocx`） | 真正 OOXML（WordprocessingML）文件，由 Rust zip |
| PDF | `@illusions-lab/mdi-to-pdf` | Rust-rendered HTML/print CSS，由本機 Chromium-family browser layout/rasterize |

五種中四種完全在 Rust 內產生：CLI 與 JavaScript package 直接呼叫 `mdi-core` renderer，沒有中間 JavaScript render step。PDF 是例外，只因它需 launch OS process；native host 的 Rust core 用 `render_pdf`/`find_chromium`，Node CLI 則經由 `@illusions-lab/mdi-to-pdf`。

## Legacy compatibility packages

`@illusions-lab/mdi-to-hast`、`mdi-to-html`、`mdi-to-epub`、`mdi-to-docx` 仍存在並發布。它們早於 Rust-native renderer，操作 `mdast`/HAST tree 而不直接呼叫 Rust render functions，對已有 `mdast`（經由[remark adapter](/zh-tw/ecosystem/remark/)）的 unified consumer 仍有用。**CLI 已不再使用它們**。重要差異是 `mdi-to-hast` stylesheet 比 Rust `render_html` embedded CSS 更接近 `SYNTAX.md`，見[stylesheet parity](/zh-tw/ecosystem/compatibility/#stylesheet-parity)。

## 所有 renderer 尚待完成的部分

EPUB/DOCX 尚未接上 [export profile](/zh-tw/ecosystem/export-profiles/) 的 cover image、configurable chapter-split level、完整 page-geometry/font control；目前只讀 front matter 的 `title`/`author`/`lang`/`writing-mode`。這在 [Rust Core API](/zh-tw/core/rust-api/#尚未實作) 明確列為 pending，而非靜默缺失。

## 下一步

- [轉譯模型](/zh-tw/core/rendering/)
- [Export profiles](/zh-tw/ecosystem/export-profiles/)
- [Migration 與 compatibility](/zh-tw/ecosystem/compatibility/)
