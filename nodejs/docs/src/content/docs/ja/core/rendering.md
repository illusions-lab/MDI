---
title: レンダリングモデルと Chromium/PDF の境界
description: 同じ IR が HTML、TXT、EPUB、DOCX、PDF になる過程。
---

**前提:** [Document IR](/ja/core/document-ir/)。

renderer は同じ `Document`（または内部で parse する source）を読み、ソースを別途解析しません。

| 出力 | 生成者 | 内容 |
| --- | --- | --- |
| HTML | `render_html` / `renderHtml` | semantic HTML と `.mdi-*` stylesheet |
| TXT | `render_text_format` / `renderTextFormat` | 5 種類の text flavor |
| EPUB | `render_epub` / `renderEpub` | XHTML、nav、CSS、OPF の EPUB 3 archive |
| DOCX | `render_docx` / `renderDocx` | OOXML archive |
| PDF | `render_pdf` / CLI | Rust HTML を Chromium が印刷 |

## HTML と TXT

`renderHtml(source)` は embedded `<style>` を含む完全な standalone HTML を返します。`renderTextFormat(source, format, indentPrefix)` の format は `txt`、`txt-ruby`、`narou`、`kakuyomu`、`aozora` です。paragraph indentation は caller が与える `indentPrefix` で、Rust が方針を決めるものではありません。

## EPUB / DOCX の baseline

両者とも外部ツールなしに Rust が有効な ZIP archive を作ります。EPUB は `<h1>` と `[[pagebreak]]` で chapter を分割し、front matter の metadata と vertical writing を使います。DOCX は text paragraph と native page break を出力しますが、現時点では ruby/boten などは base text に flatten され、ruby run・character style・page geometry は未実装です。

export profile の cover、chapter split、page geometry は EPUB/DOCX にはまだ渡されません。詳細は [Rust Core API](/ja/core/rust-api/#not-yet-implemented) を参照してください。

## Chromium/PDF の境界

1. Rust が `renderHtml` と同じ HTML を生成します。
2. `render_pdf(source, options)` が temporary HTML を作り、ローカル Chromium に `printToPDF` を依頼します。
3. `chromium_path` がなければ `find_chromium()` が macOS/Linux の既知の少数の場所を探します。見つからない場合は `Chromium executable not found; set PdfOptions.chromium_path` を返します。

```rust
pub struct PdfOptions { pub chromium_path: Option<PathBuf> }
```

Chromium は `.mdi` source を受け取らず、完成した HTML/CSS だけを layout・pagination・rasterize します。構文の誤りは Chromium ではなく Rust HTML generation の問題です。browser 内の WASM は OS process を起動できないため、PDF には Node host、desktop app、または CLI が必要です。

## 次へ

- [Rust Core API](/ja/core/rust-api/)
- [CLI](/ja/bindings/cli/)
- [出力形式](/ja/ecosystem/outputs/)
