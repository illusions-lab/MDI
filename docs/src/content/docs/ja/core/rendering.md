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

## HTML

`renderHtml(source)` は `<!DOCTYPE html>` から `</html>` まで、embedded `<style>` を含む完全な standalone HTML を返します。`lang`、`<title>`、vertical writing のときの `<html>` 上の `writing-mode: vertical-rl` はいずれも front matter から来ます。

## TXT（5 形式）

`renderTextFormat(source, format, indentPrefix)` の `format` は `txt`、`txt-ruby`、`narou`、`kakuyomu`、`aozora` です。構文ごとの正確な対応は [構文リファレンス](/ja/syntax/reference/) の TXT 書き出し表を参照してください。paragraph indentation は caller が与える文字列（通常は export profile の全角空白）を各 paragraph の前に付けるもので、Rust が方針を決めるものではありません。

## EPUB / DOCX の baseline

両者とも外部ツールなしに Rust が有効な ZIP archive を作ります。

- **EPUB** は各 `<h1>` と任意 variant の `[[pagebreak]]` で chapter を分割します。metadata（`title`、`author`、`lang`、`identifier`）は front matter から取り、なければ `Untitled` / `urn:mdi:document` を使います。vertical writing は OPF spine の `page-progression-direction="rtl"` と body の vertical-writing CSS を設定します。
- **DOCX** は plain text paragraph と、`[[pagebreak]]` の native OOXML `<w:br w:type="page"/>` を出力します。ruby、boten などの MDI typography は `render_text` と同様に base text へ flatten されます。ruby run、boten character style、page geometry はまだありません。

export profile の cover、chapter split、page geometry は EPUB/DOCX にはまだ渡されません。詳細は [Rust Core API](/ja/core/rust-api/#not-yet-implemented) を参照してください。

## Chromium/PDF の境界

1. Rust が `renderHtml` と同じ HTML を生成します。
2. `render_pdf(source, options)` が temporary HTML を作り、ローカル Chromium に `printToPDF` を依頼します。
3. `chromium_path` がなければ `find_chromium()` が macOS/Linux の既知の少数の場所を探します。見つからない場合は `Chromium executable not found; set PdfOptions.chromium_path` を返します。

```rust
pub struct PdfOptions { pub chromium_path: Option<PathBuf> }
```

production deployment ではこの探索に頼らず explicit path を渡してください。Chromium は `.mdi` source を受け取らず、完成した HTML/CSS だけを layout・pagination・font shaping・vertical-writing layout・ruby positioning・rasterize します。構文の誤りは Chromium ではなく Rust HTML generation の問題です。

### なぜ browser WebAssembly ではできないか

browser tab 内で動く WASM module は別の OS process を起動できません。parse と PDF 以外の renderer は browser でも動きますが、PDF は Chromium を spawn できる host（Node.js server、Electron/Tauri 等の desktop app、または CLI）が必要です。browser application はそのような host を呼び出してください。

## 次へ

- [Rust Core API](/ja/core/rust-api/)
- [CLI](/ja/bindings/cli/)
- [出力形式](/ja/ecosystem/outputs/)
