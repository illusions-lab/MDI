---
title: Python
description: PyPI の illusion-markdown による実装済み PyO3 binding。
---

**前提:** [Getting Started](/ja/guides/getting-started/)、[Document IR](/ja/core/document-ir/)。

`illusion-markdown` は PyO3/maturin native extension として同じ `mdi-core` を呼びます。Python 側に独自 grammar はありません。

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

## API

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

`parse` は typed class ではなく camelCase JSON dict を返します。例えば `result["document"]["children"][0]["type"]` です。non-string input は PyO3 により `TypeError`、未知の text format は `ValueError`、EPUB/DOCX rendering failure は `mdi.MdiRenderError` です。不正記法は例外ではなく literal fallback と diagnostics で扱います。

## 現在の制限

Python binding は **実装済み** です。PDF renderer はまだ export されていません（WASM のような原理的制限ではなく、現在の API の gap）。EPUB/DOCX は baseline で export profile をまだ読みません。span は UTF-8 byte offset です。

## 次へ

- [Rust Core API](/ja/core/rust-api/)
- [出力形式](/ja/ecosystem/outputs/)
