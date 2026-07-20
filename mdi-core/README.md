# mdi-core

`mdi-core` is the native Rust implementation of **illusion Markdown (MDI)**,
a Markdown extension for Japanese typography. It parses CommonMark, GFM, YAML
front matter, and MDI syntax into a portable document tree, and provides
deterministic HTML, text, EPUB, DOCX, and PDF renderers.

## Install

```toml
[dependencies]
mdi-core = "2.0"
```

## Quick start

```rust
use mdi_core::{parse_document, render_html};

let source = "第^12^話。{東京|とうきょう}は雨だった。";

let document = parse_document(source);
assert_eq!(document.children.len(), 1);

let html = render_html(source);
```

Use `parse_output` when you also need parser capabilities and diagnostics.
When rendering one parsed document in multiple formats, use the
`*_document` functions, such as `render_html_document`, to avoid parsing it
again.

## Documentation

- [API reference](https://docs.rs/mdi-core)
- [MDI documentation](https://mdi.illusions.app/)
- [Source repository](https://github.com/illusions-lab/MDI)

## License

MIT. See [LICENSE](https://github.com/illusions-lab/MDI/blob/main/LICENSE).
