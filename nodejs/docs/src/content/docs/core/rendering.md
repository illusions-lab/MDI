---
title: Rendering model and the Chromium/PDF boundary
description: How the same IR becomes HTML, TXT, EPUB, DOCX, and PDF — and exactly where Chromium's job starts and stops.
---

**Prerequisites:** [Document IR](/core/document-ir/).

Every renderer takes the same input — the parsed `Document` (or the raw source, which renderers parse internally) — and never reparses source text or reconstructs MDI boundaries. This page is about *output*; if you're looking for what's in the tree being rendered, see [Document IR](/core/document-ir/).

| Output | What produces it | Role |
| --- | --- | --- |
| HTML | `render_html` / `renderHtml` | Semantic document plus the `.mdi-*` stylesheet |
| TXT (5 flavors) | `render_text_format` / `renderTextFormat` | Plain, ruby-preserving, or a specific publishing platform's convention |
| EPUB | `render_epub` / `renderEpub` | Reflowable XHTML chapters, `nav.xhtml`, CSS, and OPF package, zipped |
| DOCX | `render_docx` / `renderDocx` | OOXML (WordprocessingML) document, zipped |
| PDF | `render_pdf` / (CLI `--to pdf`) | Rust-produced HTML/print CSS, laid out by a locally installed Chromium |

## HTML

`renderHtml(source)` returns a **complete standalone document** — `<!DOCTYPE html>` through `</html>`, including an embedded `<style>` block. `lang`, `<title>`, and (only when `writing-mode: vertical`) a `writing-mode: vertical-rl` style on `<html>` all come straight from front matter.

## TXT (five flavors)

`renderTextFormat(source, format, indentPrefix)` where `format` is one of `txt`, `txt-ruby`, `narou`, `kakuyomu`, `aozora`. See [Full syntax reference: TXT export flavors](/syntax/reference/#txt-export-flavors) for the exact mapping table per construct. `indentPrefix` is a caller-supplied string (typically full-width spaces, from an [export profile](/ecosystem/export-profiles/)) prepended to every paragraph — Rust does not decide indentation policy itself.

## EPUB and DOCX: what "baseline" means concretely

`renderEpub`/`renderDocx` build real, valid archives with no external tool — Rust writes the ZIP container, the XHTML/OOXML markup, and the CSS itself. Concretely, today:

- **EPUB** chapters split at every `<h1>` and at every `[[pagebreak]]` (any variant). Metadata (`title`, `author`, `lang`, `identifier`) comes from front matter, with `Untitled`/`urn:mdi:document` fallbacks if absent. `writing-mode: vertical` sets `page-progression-direction="rtl"` on the OPF spine and vertical writing-mode CSS on the body.
- **DOCX** is plain paragraphs of text (ruby, boten, and other MDI typography are flattened to their base text, the same way `render_text` flattens them) with native OOXML page breaks (`<w:br w:type="page"/>`) at `[[pagebreak]]`. This is a starting point, not full DOCX typography — there is no ruby run, no boten character-style, and no page geometry yet; see [Rust Core API status](/core/rust-api/#not-yet-implemented) for what's tracked as a later extension rather than a bug.
- Neither renderer yet consumes an [export profile](/ecosystem/export-profiles/) for cover images, chapter-split level, or page geometry — those are documented as **pending Rust API options**, not silently ignored: the CLI's `--config` currently only reaches the PDF and text renderers.

## The Chromium/PDF boundary

This is the one place a native process gets launched, so it's worth being exact about the division of labor:

1. Rust renders the document to the **same HTML** `renderHtml` would produce.
2. Rust writes that HTML to a temporary file and asks a **locally installed Chromium-family browser** to open it headless and call `printToPDF`, via `render_pdf(source, options)`:

```rust
pub struct PdfOptions {
    pub chromium_path: Option<PathBuf>,
}
```

```bash
# under the hood, roughly:
chromium --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=document.pdf file://document.html
```

3. If `chromium_path` isn't given, `find_chromium()` looks for a small, fixed list of common install locations (Google Chrome or Chromium on macOS at `/Applications/...`, and `google-chrome`/`chromium`/`chromium-browser` on Linux under `/usr/bin`). If none of those exist, `render_pdf` returns the error `"Chromium executable not found; set PdfOptions.chromium_path"` rather than guessing further — production deployments should always pass an explicit path instead of relying on this search.

**Chromium never receives `.mdi` source, and makes no decision about what is or isn't MDI syntax.** It receives finished HTML and CSS and performs exactly the job a browser's print dialog performs: pagination, font shaping, vertical-writing layout, ruby positioning, and rasterizing to a PDF page stream. If PDF output ever looked syntactically wrong (wrong ruby text, wrong tate-chu-yoko grouping), the bug is in Rust's HTML generation, never in Chromium — Chromium has no way to make that class of mistake because it never sees MDI notation.

### Why browser WebAssembly can't do this step

A WASM module running inside a browser tab cannot launch a separate OS process — parsing and every non-PDF renderer work fine in that environment, but PDF specifically needs a host that can spawn Chromium: a Node.js server, a desktop app (via something like Electron or Tauri), or a CLI. A browser application that needs PDF must call out to such a host.

## Next steps

- [Rust Core API status](/core/rust-api/) — every renderer function's exact signature.
- [Bindings: CLI](/bindings/cli/) — the `mdi build --to pdf` flow end to end.
- [Ecosystem: HTML / TXT / EPUB / DOCX / PDF outputs](/ecosystem/outputs/) — the same table from the package-boundary angle.
