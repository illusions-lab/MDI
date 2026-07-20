---
title: Python
description: PyO3 bindings for illusion Markdown.
---

Install the PyO3 binding from PyPI:

```bash
pip install illusion-markdown
```

The distribution is named `illusion-markdown`; its import namespace is `mdi`.

```python
import mdi

result = mdi.parse("{東京|とうきょう} ^12^")
html = mdi.render_html("# 題\n\n{東京|とうきょう}")
```

`parse()` returns the versioned Rust-owned IR and recoverable diagnostics as
JSON-compatible Python dictionaries. Source spans are UTF-8 byte offsets.
`serialize_mdi`, `render_text`, `render_text_format`, `render_epub`, and
`render_docx` also delegate directly to `mdi-core`; Python contains no MDI
tokenizer or renderer.

The package README and PyPI metadata link to this page as the official Python
API documentation.
