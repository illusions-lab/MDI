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
Use `get_mdi_text_blocks` when a search or annotation index needs source-order
plaintext blocks with one-based Unicode-grapheme coordinates and exact UTF-8
source maps. The result includes the same document IR and diagnostics, and the
source is parsed only once.
Use `resolve_mdi_source_span` for the inverse lookup: a validated half-open
UTF-8 source span becomes ordered canonical block-text and ruby-annotation
ranges. Its `complete`, `partial`, or `none` coverage reports whether every
requested source byte belongs to at least one mapped grapheme; synthetic and
unmapped projection text never creates a match.
For diagnostics or decoration batches, use `resolve_mdi_source_spans`; it
validates every span first, then parses and projects the source exactly once
and returns resolutions in input order.
When rendering one parsed document in multiple formats, use the
`*_document` functions, such as `render_html_document`, to avoid parsing it
again.

Publication profiles are also resolved in Rust. Use
`render_epub_with_profile` or `render_docx_with_profile` when you need
metadata, typography, chapter splitting, cover art, page geometry, or page
numbers. `page_size_catalog_json` exposes the same 67 paper definitions to
bindings and user interfaces, so other languages do not need to copy the
dimension table.

## Documentation

- [API reference](https://docs.rs/mdi-core)
- [MDI documentation](https://mdi.illusions.app/)
- [Source repository](https://github.com/illusions-lab/MDI)

## License

MIT. See [LICENSE](https://github.com/illusions-lab/MDI/blob/main/LICENSE).

## Automatic warichu presentation layout

The Rust core supplies two lines at 50% body size with no line gap. Capacity is
measured in half-em units at the note font size; it is a character-width estimate,
not exact proportional-font measurement. The first fragment can use the space
remaining on the current body line; following fragments use the full capacity.

```rust
let nodes = serde_json::json!([{"type":"text", "value":"一二三四五六"}]);
let fragments = mdi_core::layout_warichu_with_options(nodes.as_array().unwrap(),
    &mdi_core::WarichuOptions { first_capacity: 2, continuation_capacity: 4 });
assert_eq!(fragments.len(), 2);
```

Results contain `lines`, `html`, `widths`, `overflow`, `hardBreakAfter`, and
`sources`. Each source has a child-index `path` relative to the input inline array,
half-open `startUtf8` / `endUtf8` offsets into that leaf's visible text, and an
indivisible `group` ID. A cluster crossing formatting boundaries shares a group.
Ruby, tcy, no-break and unknown containers remain whole; their coordinates use
projected visible text (ruby base, excluding its reading). Oversized groups remain
available and report overflow. Author hard breaks are retained; automatic splits
never enter canonical MDI or plain text.

The C ABI provides `mdi_layout_warichu_json`, taking inline-array JSON and options
JSON (`firstCapacity`, `continuationCapacity`) and returning the same JSON through
`mdi_ffi_result`. Release both returned buffers with `mdi_free_buffer`.
Static HTML/EPUB includes readable precomputed lines; reader reflow can differ.
DOCX uses native Word combination groups; XML verification is not a Word rendering
test. Custom sizes, line counts and manual splitting remain tracked in MDI #85.
