# illusion-markdown

[![PyPI](https://img.shields.io/pypi/v/illusion-markdown?style=flat-square)](https://pypi.org/project/illusion-markdown/)
[![Python](https://img.shields.io/pypi/pyversions/illusion-markdown?style=flat-square)](https://pypi.org/project/illusion-markdown/)
[![License](https://img.shields.io/pypi/l/illusion-markdown?style=flat-square)](https://github.com/illusions-lab/MDI/blob/main/LICENSE)

Official Python bindings for [illusion Markdown (MDI)](https://mdi.illusions.app/).
`illusion-markdown` parses complete MDI documents, returns the versioned
document IR, and renders HTML, text, EPUB, and DOCX through the canonical
Rust implementation. Python is an ergonomic API layer only: it does not carry
a second Markdown parser or renderer.

**[Read the Python API documentation →](https://mdi.illusions.app/bindings/python/)**

## Install

```bash
pip install illusion-markdown
```

The PyPI distribution is `illusion-markdown`; the Python import namespace is
`mdi`. Python 3.10 or newer is required.

## Quick start

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
print(result["document"]["children"][0]["type"])

html = mdi.render_html(source)
open("book.html", "w", encoding="utf-8").write(html)
```

`parse()` returns a JSON-compatible dictionary with the MDI syntax version,
IR version, parser capabilities, document tree, and recoverable diagnostics.
Every source-backed span is a half-open UTF-8 byte range.

## API

| Function | Result |
| --- | --- |
| `mdi.parse(source)` | Versioned document IR and diagnostics. |
| `mdi.serialize_mdi(source)` | Canonical MDI/Markdown source. |
| `mdi.render_html(source)` | A standalone HTML document. |
| `mdi.render_text(source)` | Deterministic plain text. |
| `mdi.render_text_format(source, format)` | TXT, ruby, Narou, Kakuyomu, Aozora, or note text. |
| `mdi.render_epub(source)` | EPUB 3 archive bytes. |
| `mdi.render_docx(source)` | DOCX archive bytes. |

```python
epub_bytes = mdi.render_epub("# Chapter\n\nText")
with open("book.epub", "wb") as output:
    output.write(epub_bytes)
```

See the **[official Python documentation](https://mdi.illusions.app/bindings/python/)**
for API details, the complete MDI syntax, output formats, and architecture.

## Platform support

Prebuilt wheels are published for macOS (Intel and Apple Silicon), Linux x64,
and Windows x64. A source distribution is also available for other platforms
with a supported Rust toolchain.

## Development

The binding is tested against a locally built native extension. From this
directory, use Python 3.10 or newer:

```bash
python -m pip install -e ".[test]"
python -m pytest --cov=mdi --cov-branch
```

The test suite covers the public Python contract, including the versioned IR,
UTF-8 byte spans, diagnostics, all text exports, archive structure, type
boundaries, and the stable API surface.

## License

[MIT](https://github.com/illusions-lab/MDI/blob/main/LICENSE)
