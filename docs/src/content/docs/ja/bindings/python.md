---
title: Python
description: PyPI の illusion-markdown による実装済み PyO3 binding。
---

**前提:** [Getting Started](/ja/guides/getting-started/)、[Document IR](/ja/core/document-ir/)。

`illusion-markdown` は PyO3/maturin native extension として同じ `mdi-core` を呼びます。Python 側に独自 grammar はありません。

## この binding で解決すること

Django/Flask の publishing backend、Jupyter を使う manuscript pipeline、Python の static-site generator から、CLI を起動せずに `.mdi` を解析・描画できます。Python 側の wrapper は約 60 行で、全関数が他の binding と同じ Rust code を直接呼びます。

## Install

```bash
pip install illusion-markdown
```

PyPI distribution 名は `illusion-markdown`、import 名は `mdi` です。Python 3.10+。macOS、Linux x64、Windows x64 の wheel があり、その他では Rust toolchain を必要とする source distribution に fallback します。

## 最小例

```python
import mdi
source = "# {東京|とうきょう}の夜\n\n第^12^話\n"
result = mdi.parse(source)
print(result["document"]["children"][0]["type"])
open("book.html", "w", encoding="utf-8").write(mdi.render_html(source))
```

## Export される全 API

```python
mdi.MDI_SPEC_VERSION; mdi.MDI_IR_VERSION; mdi.TextFormat; mdi.MdiRenderError
mdi.parse(source: str) -> dict
mdi.render_html(source: str) -> str
mdi.render_text(source: str) -> str
mdi.render_text_format(source: str, format, indent_prefix: str = "") -> str
mdi.render_epub(source: str) -> bytes
mdi.render_docx(source: str) -> bytes
mdi.serialize_mdi(source: str) -> str
mdi.parse_mdi_syntax  # deprecated alias
```

## 入出力の型

`parse` は typed class や `dataclass` ではなく、JSON wire format をそのまま decode した `dict[str, Any]` を返します。key は正確に camelCase です。たとえば `result["document"]["children"][0]["type"]`、span は `startByte`/`endByte` であり `start_byte`/`end_byte` ではありません。[Document IR](/ja/core/document-ir/) の node 一覧をそのまま dict に適用できます。`render_epub` と `render_docx` は `bytes` を返すため、`"wb"` で開いた file に書き込んでください。

## Diagnostic と error handling

不正な MDI 記法は例外ではなく literal fallback と diagnostics で扱います。現在実装されている diagnostic は [唯一の `mdi.version.unsupported`](/ja/core/diagnostics/) です。non-string input は PyO3 により `TypeError`、未知の text format は `ValueError`、EPUB/DOCX archive writer の実際の失敗だけは `mdi.MdiRenderError` です。`mdi.parse()` を diagnostics の代わりに `try`/`except` で包まないでください。

```python
mdi.parse(None)                              # TypeError
mdi.render_text_format("text", "invalid")  # ValueError
```

## IR version と UTF-8 byte span

`mdi.parse()` は decoded `irVersion` を `mdi.MDI_IR_VERSION` と照合し、違えば `RuntimeError` を送出します。返るすべての span は UTF-8 **byte** offset です。Python の `str` は code point の列なので、文字 index にするには明示的な変換が必要です。

```python
def byte_span_to_str_index(source: str, byte_offset: int) -> int:
    return len(source.encode("utf-8")[:byte_offset].decode("utf-8", errors="ignore"))
```

## 現在の実装状況

Python binding は **実装済み・公開済み・テスト済み** です。test suite は IR shape、diagnostic、byte span、五つの text format、EPUB/DOCX archive、ここにある error path を検証し、branch coverage 95% を要求します。

## この binding がしないこと

- **PDF function はまだありません。** Python には WASM のような原理的制限はありませんが、現在 `mdi.render_pdf` は export されていません。Python 隣接 workflow の PDF は [CLI](/ja/bindings/cli/) を使ってください。
- **独自 grammar はありません。** CLI/Rust と差があれば短い wrapper か core のバグです。
- **export profile を適用しません。** `render_epub`/`render_docx` は source だけを受け、cover、chapter split、page geometry はまだ binding 経由で渡せません。

## 次へ

- [Rust Core API](/ja/core/rust-api/)
- [出力形式](/ja/ecosystem/outputs/)
