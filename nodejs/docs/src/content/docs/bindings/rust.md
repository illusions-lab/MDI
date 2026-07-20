---
title: Rust
description: Using mdi-core directly from a Rust project — the native, zero-FFI-overhead path.
---

**Prerequisites:** [Document IR](/core/document-ir/), [Rust Core API status](/core/rust-api/).

## What this binding solves

Every other language interface (JavaScript/WASM, and eventually Python and Swift) is a thin wrapper around this crate. If you're writing a Rust application, tool, or another language's native binding, you can depend on `mdi-core` directly and skip the FFI/WASM boundary entirely.

## Install

Install `mdi-core` from [crates.io](https://crates.io/crates/mdi-core):

```toml
[dependencies]
mdi-core = "2.0"
```

## Minimal executable example

```rust
use mdi_core::{parse_document, render_html};

fn main() {
    let source = "第^12^話。{東京|とうきょう}は雨だった。";

    let document = parse_document(source);
    assert_eq!(document.children.len(), 1); // one paragraph

    println!("{}", render_html(source));
}
```

```bash
cargo run
```

```html
<!DOCTYPE html><html lang="ja">...<body><p><span class="mdi-tcy">12</span>話。<ruby class="mdi-ruby">東京<rp>（</rp><rt>とうきょう</rt><rp>）</rp></ruby>は雨だった。</p></body></html>
```

## Input and output types

`parse_document(&str) -> Document` and `parse_output(&str) -> ParseOutput` are the two parsing entry points; every renderer (`render_html`, `render_text`, `render_text_format`, `render_epub`, `render_docx`, `render_pdf`) accepts either the raw `&str` source (and parses internally) or a `&Document` you already parsed, via the `*_document` suffix variant — e.g. `render_html(source)` vs. `render_html_document(&document)`. Use the `_document` variants when you need to parse once and render multiple formats from the same tree. Full signatures: [Rust Core API status](/core/rust-api/).

## Diagnostics and error handling

`parse_document`/`parse_output` never panic on malformed MDI syntax — that's handled by literal fallback, same as every other binding (see [Diagnostics](/core/diagnostics/)). The renderer functions that touch the filesystem or a subprocess (`render_epub`, `render_docx`, `render_pdf`) return `Result<Vec<u8>, String>` instead, because those really can fail for reasons outside MDI's control (I/O errors, a missing Chromium executable):

```rust
use mdi_core::{render_pdf, PdfOptions};

match render_pdf(source, &PdfOptions::default()) {
    Ok(bytes) => std::fs::write("out.pdf", bytes)?,
    Err(message) => eprintln!("PDF render failed: {message}"),
    // e.g. "Chromium executable not found; set PdfOptions.chromium_path"
}
```

## IR version and UTF-8 byte spans

`MDI_IR_VERSION` and `MDI_SPEC_VERSION` are `&'static str` constants exported directly — check them if you're persisting a `ParseOutput` and reloading it later, the same way any other binding must. `SourceSpan { start_byte: u32, end_byte: u32 }` is a half-open UTF-8 byte range, exactly as described in [Diagnostics and UTF-8 source spans](/core/diagnostics/) — being in Rust doesn't change the unit; it's still bytes, not `char` indices, because `str` in Rust is itself UTF-8 bytes and indexing by anything else would require an extra pass every binding would have to pay for.

## Current implementation status

Parsing (`parse_document`/`parse_output`), serialization (`serialize_mdi`), and every renderer (`render_html`, `render_text_format`, `render_epub`, `render_docx`, `render_pdf`) are implemented today, at the "baseline" level described on [Rust Core API status](/core/rust-api/#not-yet-implemented). There is no separate `validate`/`normalize` API distinct from `parse_output`/`serialize_mdi` — see that same page for exactly what's missing.

## What this binding doesn't do

- **No async API.** Every function here is synchronous; `render_pdf` blocks on the Chromium subprocess. Wrap it in `spawn_blocking` (Tokio) or an equivalent if you're calling it from an async runtime.

## Next steps

- [Rust Core API status](/core/rust-api/) — every function, in full.
- [API reference on docs.rs](https://docs.rs/mdi-core/).
- [Rendering model](/core/rendering/) — what each renderer's output actually contains, including the Chromium/PDF boundary.
