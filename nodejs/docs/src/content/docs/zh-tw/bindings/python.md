---
title: Python
description: PyPI 的 illusion-markdown：真實、以 PyO3 為基礎的 Python API。
---

**先備知識：**[快速開始](/zh-tw/guides/getting-started/)、[Document IR](/zh-tw/core/document-ir/)。

## 這個綁定解決什麼

要從 Django/Flask backend、Jupyter manuscript pipeline 或 Python static-site generator 解析／轉譯 `.mdi`，不必呼叫 CLI。`illusion-markdown` 經由 [PyO3](https://pyo3.rs)/[maturin](https://www.maturin.rs) 將 `mdi-core` 編譯成 native extension；約 60 行的 Python wrapper 沒有自己的 MDI grammar，每個 function 都直接呼叫同一份 Rust。

## 安裝

```bash
pip install illusion-markdown
```

PyPI distribution 名稱是 `illusion-markdown`，**import name 是 `mdi`**。需要 Python 3.10+；macOS（Intel/Apple Silicon）、Linux x64、Windows x64 有預建 wheel，其他 platform 會使用需要 Rust toolchain 的 source distribution。

## 最小可執行範例

```python
import mdi
source = "# {東京|とうきょう}の夜\n\n第^12^話\n"
result = mdi.parse(source)
print(result["document"]["children"][0]["type"])  # "heading"
html = mdi.render_html(source)
open("book.html", "w", encoding="utf-8").write(html)
```

## 所有 exported function

```python
mdi.MDI_SPEC_VERSION  # "2.0"
mdi.MDI_IR_VERSION    # "1.0"
mdi.TextFormat        # Literal["txt", "txt-ruby", "narou", "kakuyomu", "aozora"]
mdi.MdiRenderError
mdi.parse(source: str) -> dict
mdi.render_html(source: str) -> str
mdi.render_text(source: str) -> str
mdi.render_text_format(source: str, format: mdi.TextFormat, indent_prefix: str = "") -> str
mdi.render_epub(source: str) -> bytes
mdi.render_docx(source: str) -> bytes
mdi.serialize_mdi(source: str) -> str
mdi.parse_mdi_syntax  # deprecated alias
```

現時沒有 `render_pdf`。

## Input/output、diagnostics 與 errors

`parse()` 回傳不是 typed class/dataclass 的 plain `dict[str, Any]`，由 JSON wire format 直接 `json.loads` 而來，保留**camelCase** key：`irVersion`、`syntaxVersion`、`document`、`diagnostics`，node 裡是 `startByte`/`endByte`。因此請用 `result["document"]["children"][0]["type"]`，且 [Document IR](/zh-tw/core/document-ir/) 完全適用。`render_epub`/`render_docx` 是 `bytes`，以 binary mode 寫檔。

普通 malformed MDI 不 raise，而以 literal fallback 處理；`diagnostics` 唯一實作 code 為 `mdi.version.unsupported`，見[診斷](/zh-tw/core/diagnostics/)。非 `str` input 是 PyO3 自動的 `TypeError`；`mdi.render_text_format("text", "invalid")` 是 `ValueError: Unsupported text format: invalid`；只有 Rust EPUB/DOCX archive writer 失敗才會是 `mdi.MdiRenderError`。`parse()` 也會在 IR version 不符時 raise `RuntimeError`。

## IR version 與 UTF-8 byte spans

span 是 UTF-8 **byte** offset，不是 Python `str` 的 code-point index；要轉換須明確做 `source.encode("utf-8")`。請見[診斷與 source spans](/zh-tw/core/diagnostics/#spans-precisely)。

## 目前實作狀態與限制

以上功能都已發布並受測，並非 speculative binding。唯一重要空缺是**尚無 PDF function**：Python 能 spawn subprocess，沒有 WASM 那類根本限制，但 package 今日就是未 expose `mdi.render_pdf`；Python workflow 的 PDF 暫用 [CLI](/zh-tw/bindings/cli/)。它不含自己的 grammar，也不套用 export profile；`render_epub`/`render_docx` 仍是 Rust baseline renderer，見[Rust Core API](/zh-tw/core/rust-api/#not-yet-implemented)。

## 下一步

- [Rust Core API](/zh-tw/core/rust-api/)
- [Document IR](/zh-tw/core/document-ir/)
- [CLI](/zh-tw/bindings/cli/)
