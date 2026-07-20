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
source = """---
title: 東京の夜
lang: ja
---

# {東京|とうきょう}の夜

第^12^話
"""
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

## 輸入與輸出型別

`parse()` 回傳不是 typed class/dataclass 的 plain `dict[str, Any]`，由 JSON wire format 直接 `json.loads` 而來，保留**camelCase** key：`irVersion`、`syntaxVersion`、`document`、`diagnostics`，node 裡是 `startByte`/`endByte`。因此請用 `result["document"]["children"][0]["type"]`，且 [Document IR](/zh-tw/core/document-ir/) 完全適用。`render_epub`/`render_docx` 是真正的 `bytes`（Rust 端由 `PyBytes` 支援），必須以 binary mode（`"wb"`）寫檔。

## 診斷與錯誤處理

一般格式不正確的 MDI 不會 raise，而以 literal fallback 處理；回傳 dict 的 `diagnostics` 唯一已實作 code 是 `mdi.version.unsupported`（見[診斷](/zh-tw/core/diagnostics/)）：

```python
result = mdi.parse("---\nmdi: '3.0'\n---\n\n本文")
# result["diagnostics"]：
# [{'severity': 'warning', 'code': 'mdi.version.unsupported',
#   'message': 'MDI 3.0 is newer than the supported 2.0',
#   'span': {'startByte': 0, 'endByte': 18}}]
```

三種真實且不同的失敗模式如下：非 `str` input 是 PyO3 自動產生的 `TypeError`；`mdi.render_text_format("text", "invalid")` 是 `ValueError: Unsupported text format: invalid`；只有 Rust 的 EPUB/DOCX archive writer 本身失敗（例如底層 I/O）才會是 `mdi.MdiRenderError`。一般文件不會觸發最後一種。保留 `try`／`except` 給這些情況，勿用它取代檢查 `result["diagnostics"]`。

## IR version 與 UTF-8 byte spans

`mdi.parse()` 會自行將 decoded `irVersion` 與 `mdi.MDI_IR_VERSION` 比較；若不同會 raise `RuntimeError: Unsupported MDI IR version: ...`。span 是 UTF-8 **byte** offset，不是 Python `str` 的 code-point index；要轉換須明確做 `source.encode("utf-8")`。請見[診斷與 source spans](/zh-tw/core/diagnostics/#spans精確來說)。

```python
def byte_span_to_str_index(source: str, byte_offset: int) -> int:
    return len(source.encode("utf-8")[:byte_offset].decode("utf-8", errors="ignore"))
```

## 目前實作狀態

以上功能都已發布並受測，並非 speculative binding。套件自己的測試會驗證 IR shape、diagnostic 格式、byte span、五種文字格式、EPUB/DOCX archive 結構與上述錯誤路徑，並強制至少 95% branch coverage。

## 此綁定不做什麼

- **尚無 PDF function。**Python 可以 spawn subprocess，沒有 WASM 那類根本限制，但 package 今天未 expose `mdi.render_pdf`；Python workflow 的 PDF 暫用 [CLI](/zh-tw/bindings/cli/)。
- **沒有自己的 grammar。**每個 function 都直接呼叫同一個 `mdi-core`；若與 CLI 或 Rust 不一致，是這個約 60 行 wrapper 的 bug，而不是另一套 parser。
- **不套用 export profile。**`render_epub`／`render_docx` 只收 `source`，仍是 Rust baseline renderer；cover、分章與頁面幾何尚未接入，見[Rust Core API](/zh-tw/core/rust-api/#尚未實作)。

## 下一步

- [Rust Core API](/zh-tw/core/rust-api/)
- [Document IR](/zh-tw/core/document-ir/)
- [CLI](/zh-tw/bindings/cli/)
