---
title: 轉譯模型與 Chromium/PDF 邊界
description: 同一份 IR 如何成為 HTML、TXT、EPUB、DOCX 與 PDF，以及 Chromium 工作的精確邊界。
---

**先備知識：**[Document IR](/zh-tw/core/document-ir/)。

每個 renderer 的輸入都是同一份 parsed `Document`（或內部自行 parse 的 raw source），絕不重新解析 source text 或重建 MDI boundaries。本頁談輸出；tree 內容請見 [Document IR](/zh-tw/core/document-ir/)。

| 輸出 | 產生者 | 角色 |
| --- | --- | --- |
| HTML | `render_html` / `renderHtml` | Semantic document 與 `.mdi-*` stylesheet |
| TXT（5 種） | `render_text_format` / `renderTextFormat` | 純文字、保留 ruby 或特定投稿平台慣例 |
| EPUB | `render_epub` / `renderEpub` | 可重排 XHTML chapters、`nav.xhtml`、CSS 與 OPF package，打包為 zip |
| DOCX | `render_docx` / `renderDocx` | OOXML（WordprocessingML）文件，打包為 zip |
| PDF | `render_pdf` /（CLI `--to pdf`） | Rust 產生 HTML/print CSS，再由本機 Chromium layout |

## HTML

`renderHtml(source)` 回傳**完整 standalone document**，從 `<!DOCTYPE html>` 到 `</html>`，含 embedded `<style>`。`lang`、`<title>` 及僅在 `writing-mode: vertical` 時的 `<html>` `writing-mode: vertical-rl` style 都直接取自 front matter。

## TXT（五種）

`renderTextFormat(source, format, indentPrefix)` 的 `format` 為 `txt`、`txt-ruby`、`narou`、`kakuyomu` 或 `aozora`。每個 construct 的映射見[完整 syntax reference：TXT export flavors](/zh-tw/syntax/reference/#txt-export-flavors)。`indentPrefix` 是 caller 指定、加到每段前的字串（通常來自 [export profile](/zh-tw/ecosystem/export-profiles/) 的全形空白）；Rust 不替使用者決定縮排政策。

## EPUB 與 DOCX：baseline 的具體含義

`renderEpub`/`renderDocx` 不使用外部工具：Rust 自行寫入 ZIP container、XHTML/OOXML markup 與 CSS。

- **EPUB** 會在每個 `<h1>` 與每個 `[[pagebreak]]` 分章；metadata（`title`、`author`、`lang`、`identifier`）來自 front matter，缺省為 `Untitled`/`urn:mdi:document`。`writing-mode: vertical` 在 OPF spine 設 `page-progression-direction="rtl"`，並在 body 設 vertical CSS。
- **DOCX** 目前是純文字段落；ruby、boten 等 MDI typography 會 flatten 成 base text，與 `render_text` 相同。`[[pagebreak]]` 產生原生 OOXML `<w:br w:type="page"/>`。尚無 ruby run、boten character style 或 page geometry；請見 [Rust Core API](/zh-tw/core/rust-api/#not-yet-implemented)。
- 兩者尚未消費 [export profile](/zh-tw/ecosystem/export-profiles/) 的 cover、chapter-split level 或 page geometry；這些是**待加入的 Rust API options**。CLI 的 `--config` 現只送到 PDF 與 text renderer。

## Chromium/PDF 邊界

唯一會啟動 native process 的地方，分工如下：

1. Rust 產生與 `renderHtml` 相同的 HTML。
2. Rust 寫入 temporary file，再透過 `render_pdf(source, options)` 要求**本機已安裝的 Chromium-family browser** headless 開啟並呼叫 `printToPDF`：

```rust
pub struct PdfOptions { pub chromium_path: Option<PathBuf>, }
```

```bash
chromium --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=document.pdf file://document.html
```

3. 未指定 `chromium_path` 時，`find_chromium()` 只搜尋固定常見位置：macOS `/Applications/...` 的 Google Chrome/Chromium，或 Linux `/usr/bin` 的 `google-chrome`/`chromium`/`chromium-browser`。找不到時回傳 `"Chromium executable not found; set PdfOptions.chromium_path"`；production 應明確傳 path。

**Chromium 永遠不會收到 `.mdi` source，也不決定何者是 MDI syntax。**它只收到完成的 HTML/CSS，執行 browser print dialog 同類工作：pagination、font shaping、vertical-writing layout、ruby positioning 與 rasterizing 成 PDF stream。若 PDF 的 ruby/tate-chu-yoko 語意錯誤，bug 必在 Rust HTML generation，絕非 Chromium。

### 為何 browser WebAssembly 無法做此步驟

在 browser tab 的 WASM 不能啟動另一個 OS process。解析與非 PDF renderer 可在其中運作，但 PDF 需要能 spawn Chromium 的 host：Node.js server、desktop app（Electron/Tauri 等）或 CLI。browser app 若需 PDF，必須呼叫這類 host。

## 下一步

- [Rust Core API 狀態](/zh-tw/core/rust-api/)
- [CLI 綁定](/zh-tw/bindings/cli/)
- [輸出格式](/zh-tw/ecosystem/outputs/)
