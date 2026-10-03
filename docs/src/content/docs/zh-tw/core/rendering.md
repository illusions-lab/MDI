---
title: 轉譯模型與 Chromium/PDF 邊界
description: Rust 如何把同一份 MDI 文件轉成 baseline／設定型輸出，以及 PDF host 從哪裡接手。
---

**先備知識：**[Document IR](/zh-tw/core/document-ir/)、[export profiles](/zh-tw/ecosystem/export-profiles/)。

## 一份語意、一份出版契約

Rust 負責 `.mdi` parse、diagnostic code、UTF-8 span、semantic output 與 publication profile resolution。Ruby、tate-chu-yoko、不換行、kern、blank paragraph、pagebreak，以及紙張尺寸和 EPUB/DOCX layout，都在同一處決定。

Profile 與文件語意彼此分開：更換字型或紙張，不會改變 MDI 的解析方式。Rust 會驗證 profile，並套用 metadata、chapter、typography、page setup 與 numbering；PDF host 只負責尋找／啟動 Chromium 並取回 bytes，app UI preference 仍由應用程式決定。

設定型 publication export 必須明示 `layout.system`。`japanese-publisher` 是 strict 的日文書籍契約：橫書為 `Shirokuban`、10 pt 明朝體、鏡像頁、左裝訂 27×26；直書為 A4 landscape 小說原稿、鏡像頁、右裝訂 40×30。`word` 刻意採不相容的契約：A4、四邊 25.4 mm、無鏡像、流動 `typographic` layout，且拒絕 `strict`。

| 輸出 | baseline | 可設定 route |
| --- | --- | --- |
| HTML | `renderHtml(source)` | `{ bodyOnly: true }` 或附 diagnostics/headings 的 `renderHtmlWithDiagnostics`。 |
| TXT | `renderTextFormat` | caller 傳入 indent。 |
| EPUB | `renderEpub(source)` | `await renderEpub(source, { profile, cover })`。 |
| DOCX | `renderDocx(source)` | `await renderDocx(source, profile)`。 |
| PDF | — | `@illusions-lab/mdi/node` 將 Rust 準備好的 HTML、page geometry 與 page-number template 交給 Chromium-capable host。 |

## diagnostics 與 HTML

匯出 UI 先呼叫 `parse(source)`/`prepareRender(source)`。`document` 保留 span，`diagnostics` 保留 warning。`renderHtmlWithDiagnostics` 另回傳 HTML 與 headings。Rust ABI 尚不能讓 renderer 接受 serialized IR handle，因此 helper 依序以同一份 source validate/render，而不創造第二個 parser。

`renderHtml` 回傳有 stylesheet 的完整 page；`bodyOnly` 回傳供 app shell 使用的 body contents。ruby 使用 `<ruby>`/`<rt>`/`<rp>`，MDI extension 有可預期的 `mdi-*` class。

## EPUB/DOCX

單一參數的 synchronous call 是 Rust baseline export。設定型 JavaScript call 為了相容性保留 async 形式，但 profile 驗證與 EPUB/DOCX archive 生成都在 Rust 完成。JavaScript 不會保留另一份 page-size table 或 document generator。EPUB 接受 metadata、直排、font、indent、chapter level、JPEG/PNG cover；DOCX 接受 metadata、page size/orientation/margin、font/size/line spacing/indent、page number。

DOCX 將 pagebreak、書寫方向、paragraph 與可用 inline/run formatting map 到 OOXML。ruby、tate-chu-yoko、禁則/不換行、kern、強制 blank 的結果是 OOXML approximation，不是 browser-identical。重要組版請在實際 reader 驗證。

## Chromium/PDF 邊界

`@illusions-lab/mdi/node` 的 `preparePdfExport(source, profile)` 回傳 Rust 已準備完成的 HTML 與 print data；Electron 可在自己的 BrowserWindow print。`renderPdfWithChromium` 會 load 另外安裝的 `@illusions-lab/mdi-to-pdf` (Playwright)，或使用 Electron-compatible `{ renderHtmlToPdf }`。

紙張、橫向、邊距、直/橫排、font/size/line spacing、每行字數/每頁行數、indent 與 page-number template 都由 Rust 解決並套用。host 只負責執行 Chromium。browser WASM 不能 spawn Chromium，須把 request 交給 Node/Electron/Tauri/CLI host。Chromium 收到的是完成 HTML/CSS 與 print data，從不接觸 `.mdi`。

## 契約測試會檢查什麼

CI 會先完成 unit test 與 coverage，再執行 publication contracts。DOCX
會經過 .NET Open XML SDK 驗證，並由 LibreOffice 實際匯入；PDF 會檢查
結構與 page geometry，EPUB 使用 W3C EPUBCheck，HTML 則核對輸出契約。
這能抓到「ZIP 可以解開，但讀者使用的應用程式仍無法開啟」這類問題。

- [JavaScript / TypeScript](/zh-tw/bindings/javascript/)
- [CLI](/zh-tw/bindings/cli/)
- [Diagnostics](/zh-tw/core/diagnostics/)
