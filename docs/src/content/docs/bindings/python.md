---
title: Python
description: illusion-markdown on PyPI — the real, PyO3-backed Python API, verified against its published source.
---

**Prerequisites:** [Getting Started](/guides/getting-started/), [Document IR](/core/document-ir/).

## What this binding solves

You need to parse or render `.mdi` documents from Python — a Django/Flask publishing backend, a Jupyter-based manuscript pipeline, or a Python static-site generator — without shelling out to the CLI. `illusion-markdown` compiles `mdi-core` to a native extension via [PyO3](https://pyo3.rs)/[maturin](https://www.maturin.rs) and exposes it as ordinary Python functions; the Python-side wrapper module is about 60 lines and contains no MDI grammar of its own — every function is a direct call into the same Rust code every other binding calls.

## Install

```bash
pip install illusion-markdown
```

The **distribution name** on PyPI is `illusion-markdown`; the **import name** is `mdi`. Requires Python 3.10+. Prebuilt wheels are published for macOS (Intel and Apple Silicon), Linux x64, and Windows x64; other platforms fall back to the source distribution, which needs a Rust toolchain to build.

## Minimal executable example

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

## Every exported function

```python
import mdi

mdi.MDI_SPEC_VERSION      # "2.0"
mdi.MDI_IR_VERSION        # "1.0"
mdi.TextFormat            # Literal["txt", "txt-ruby", "narou", "kakuyomu", "aozora", "note"]
mdi.MdiRenderError        # Exception subclass — see "Diagnostics and error handling"

mdi.parse(source: str) -> dict                                    # versioned IR + diagnostics
mdi.render_html(source: str) -> str
mdi.render_text(source: str) -> str                               # the plain "txt" flavor
mdi.render_text_format(source: str, format: TextFormat, indent_prefix: str = "") -> str
mdi.render_epub(source: str) -> bytes
mdi.render_docx(source: str) -> bytes
mdi.serialize_mdi(source: str) -> str                              # canonical MDI round-trip
mdi.parse_mdi_syntax                                               # deprecated alias for mdi.parse
```

There is currently **no `render_pdf`** in this binding — see "What this binding doesn't do" below.

## Input and output types

`parse()` does **not** return a typed class or a `dataclass` — it returns a plain `dict[str, Any]`, decoded directly from the same JSON wire format every other binding uses, with the **exact same camelCase keys** (`irVersion`, `syntaxVersion`, `document`, `diagnostics`; and inside the tree, `startByte`/`endByte`, not `start_byte`/`end_byte`). This is a deliberate, verified detail: the Python wrapper does `json.loads(_native.parse_json(source))` and returns the result as-is, so [Document IR](/core/document-ir/)'s node catalogue applies to this binding's dictionaries verbatim — just access fields with `result["document"]["children"][0]["type"]` instead of dot notation.

`render_epub`/`render_docx` return real `bytes` objects (backed by `PyBytes` on the Rust side) — write them with a file opened in binary mode (`"wb"`), not text mode.

## Diagnostics and error handling

Ordinary malformed MDI syntax never raises — it's handled by each construct's literal-fallback rule, exactly like every other binding, and `diagnostics` in the returned dict reports the one currently-implemented case (`mdi.version.unsupported`; see [Diagnostics](/core/diagnostics/)):

```python
result = mdi.parse("---\nmdi: '3.0'\n---\n\n本文")
result["diagnostics"]
# [{'severity': 'warning', 'code': 'mdi.version.unsupported',
#   'message': 'MDI 3.0 is newer than the supported 2.0',
#   'span': {'startByte': 0, 'endByte': 18}}]
```

Three real, distinct failure modes exist, and each raises a different exception:

```python
mdi.parse(None)
# TypeError — PyO3's automatic argument-type check; every function rejects non-str input this way

mdi.render_text_format("text", "invalid")
# ValueError: Unsupported text format: invalid

mdi.render_epub(some_source_that_makes_rust_fail)
# mdi.MdiRenderError — raised only when the Rust EPUB/DOCX archive writer itself fails
# (e.g. an underlying I/O error); ordinary documents never trigger this
```

`TypeError` comes for free from PyO3's own argument marshalling — every function in this module takes `&str` on the Rust side, so passing anything that isn't `str` (including `None`) fails before any MDI-specific code runs. `ValueError` and `MdiRenderError` are the two cases the binding's own Rust wrapper (`python/src/lib.rs`) raises explicitly. Reserve `try`/`except` for these three; do not wrap `mdi.parse()` in `try`/`except` as a substitute for checking `result["diagnostics"]`.

## IR version and UTF-8 byte spans

`mdi.parse()` checks the decoded `irVersion` against `mdi.MDI_IR_VERSION` itself and raises `RuntimeError: Unsupported MDI IR version: ...` if they don't match — the same defensive check [JavaScript's `parse()`](/bindings/javascript/) performs. Every span in the returned dict is a UTF-8 **byte** offset (see [Diagnostics and UTF-8 source spans](/core/diagnostics/#spans-precisely)) — Python's `str` is a sequence of code points, not bytes, so converting a span into a Python string index needs the same explicit `source.encode("utf-8")`-based conversion JavaScript needs; there is no implicit conversion.

```python
def byte_span_to_str_index(source: str, byte_offset: int) -> int:
    return len(source.encode("utf-8")[:byte_offset].decode("utf-8", errors="ignore"))
```

## Current implementation status

Everything listed above is real, published, and tested — the package's own test suite (`python/tests/test_mdi.py`) asserts the exact IR shape, diagnostic format, byte-span validity, all six text-format outputs, EPUB/DOCX archive structure, and every error path shown on this page, with a minimum 95% branch-coverage requirement. This is not a thin or speculative binding.

## What this binding doesn't do

- **No PDF function yet.** Unlike the [JavaScript/WASM binding](/bindings/javascript/), Python *can* spawn a subprocess — there's no fundamental barrier like WASM's — but `mdi.render_pdf` simply isn't exposed in this package today. Use the [CLI](/bindings/cli/) for PDF output from a Python-adjacent workflow in the meantime.
- **No grammar of its own.** Every function calls straight into the same `mdi-core` crate every other binding uses; a discrepancy between this binding and the CLI or Rust directly would be a bug in the ~60-line wrapper, not an independent parser to fix.
- **No export-profile arguments yet.** `render_epub`/`render_docx` currently take only `source`. Rust already provides the configured EPUB/DOCX implementation; the Python wrapper has not exposed those profile and cover parameters yet.

## Next steps

- [Rust Core API status](/core/rust-api/) — the exact Rust functions this package wraps.
- [Document IR](/core/document-ir/) — the node catalogue for the dictionaries `mdi.parse()` returns.
- [Bindings: CLI](/bindings/cli/) — the same functions, from the command line, including PDF.
