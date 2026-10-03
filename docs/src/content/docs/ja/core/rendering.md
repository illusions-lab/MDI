---
title: レンダリングモデルと Chromium/PDF の境界
description: 一つの MDI document を Rust が baseline／設定付き output にし、PDF host がどこから引き継ぐか。
---

**前提:** [Document IR](/ja/core/document-ir/)、[Export profiles](/ja/ecosystem/export-profiles/)。

## 一つの意味、一つの publication contract

Rust は `.mdi` parse、diagnostic code と UTF-8 span、semantic output、publication profile の解決を担います。ruby、tate-chu-yoko、改行禁止、kern、blank paragraph、pagebreak に加え、紙面寸法と EPUB/DOCX layout も一か所で決まります。

profile は document の意味から独立しています。font や page size を変えても MDI の解釈は変わりません。Rust が profile を検証して metadata、chapter、typography、page setup、numbering を適用し、PDF host は Chromium の起動と byte の受け取りだけを担当します。

設定付き publication export は `layout.system` を明示します。`japanese-publisher` は strict な和文 book contract です。横書きは `Shirokuban`・10 pt 明朝体・mirror spread・左綴じ 27×26、縦書きは A4 landscape 小説原稿・mirror spread・右綴じ 40×30 です。`word` は意図的に別契約で、A4、四辺 25.4 mm、mirror なし、flowing `typographic` layout を使い、`strict` を reject します。

| 出力 | baseline | 設定付き route |
| --- | --- | --- |
| HTML | `renderHtml(source)` | `{ bodyOnly: true }`、または diagnostics/headings 付き `renderHtmlWithDiagnostics`。 |
| TXT | `renderTextFormat` | caller が indent を渡す。 |
| EPUB | `renderEpub(source)` | `await renderEpub(source, { profile, cover })`。 |
| DOCX | `renderDocx(source)` | `await renderDocx(source, profile)`。 |
| PDF | — | `@illusions-lab/mdi/node` が Rust で準備した HTML、page geometry、page-number template を Chromium host に渡す。 |

## diagnostics と HTML

export UI では先に `parse(source)`/`prepareRender(source)` を呼びます。`document` は span、`diagnostics` は warning を保持します。`renderHtmlWithDiagnostics` は HTML と headings も返します。Rust ABI は serializable IR handle をまだ renderer に渡せないため、同じ source を順に validate/render し、別 parser を作りません。

`renderHtml` は stylesheet 付き page、`bodyOnly` は app shell 用の body contents を返します。ruby は `<ruby>`/`<rt>`/`<rp>`、MDI extension は predictable な `mdi-*` class です。

## EPUB/DOCX

一引数の synchronous call は Rust baseline export です。設定付き JavaScript call は互換性のため async の形を保ちますが、profile の検証と EPUB/DOCX archive の生成は Rust で行います。JavaScript に別の page-size table や document generator はありません。EPUB は metadata、縦書き、font、indent、chapter level、JPEG/PNG cover を、DOCX は metadata、page size/orientation/margin、font/size/line spacing/indent、page number を受け取ります。

DOCX は pagebreak、書字方向、paragraph と可能な inline/run formatting を OOXML に map します。ruby、tate-chu-yoko、禁則/改行禁止、kern、強制 blank は browser identical ではなく OOXML の近似です。重要な組版は実際の reader で確認してください。

## Chromium/PDF の境界

`@illusions-lab/mdi/node` の `preparePdfExport(source, profile)` は Rust で準備済みの HTML と print data を返し、Electron は自前 BrowserWindow で print できます。`renderPdfWithChromium` は別 install の `@illusions-lab/mdi-to-pdf` (Playwright) を load するか Electron-compatible `{ renderHtmlToPdf }` を使います。

paper、landscape、margin、縦横、font/size/line spacing、文字数/行数、indent、page-number template は Rust が解決して適用します。host は Chromium の実行を担当します。browser WASM は Chromium を spawn できないため request を Node/Electron/Tauri/CLI host へ送ります。Chromium が受け取るのは完成 HTML/CSS と print data であり `.mdi` ではありません。

## Contract test が確認すること

最初に unit test と coverage を通し、その後で publication contract を
実行します。DOCX は .NET Open XML SDK と LibreOffice、PDF は構造と
page geometry、EPUB は W3C EPUBCheck、HTML は出力 contract で確認します。
ZIP として開けるだけでなく、読者が使う application で扱えることまで
release 前に確かめます。

- [JavaScript / TypeScript](/ja/bindings/javascript/)
- [CLI](/ja/bindings/cli/)
- [Diagnostics](/ja/core/diagnostics/)
