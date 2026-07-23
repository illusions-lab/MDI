# `@illusions-lab/mdi-cli`

Command-line interface for building complete `.mdi` documents through the
Rust-authoritative MDI engine.

## Install

```sh
npm install --global @illusions-lab/mdi-cli
```

## Build a document

```sh
mdi build input.mdi --to html|pdf|epub|docx|txt|txt-ruby|narou|kakuyomu|aozora|note|txt-all \
  [--config export.json] [-o output]
```

HTML, EPUB, DOCX, and text output call `mdi-core` directly through the
JavaScript binding. With `--config`, Rust also validates and applies EPUB/DOCX
metadata, typography, chapter splitting, cover art, page geometry, and
numbering. PDF receives Rust-prepared HTML and print data, then uses Chromium
solely for page layout; Chromium never receives or parses MDI source.

`txt-all` writes every text variant next to the input and does not accept `-o`.
The `narou`, `kakuyomu`, `aozora`, and `note` variants are contract-tested
against their platform-owned notation manuals. note output is UTF-8 editor
input; Aozora output is Shift_JIS with CRLF;
an unencodable character fails explicitly instead of being replaced with `?`.

## Examples

```sh
# Rust renders semantic HTML.
mdi build novel.mdi --to html -o public/novel.html

# Rust produces EPUB and DOCX archives.
mdi build novel.mdi --to epub
mdi build novel.mdi --to docx

# PDF uses Rust HTML and Chromium only for print layout.
mdi build novel.mdi --to pdf --config print.json
```

## Architecture

The CLI does not parse MDI or implement publication formats itself. HTML,
EPUB, DOCX, and text call the Rust engine through `@illusions-lab/mdi`.
Profile defaults, validation, paper dimensions, and print CSS also come from
Rust. The host-specific step is launching Chromium for PDF.

## Documentation

- [CLI guide](https://mdi.illusions.app/bindings/cli/)
- [Export profiles](https://mdi.illusions.app/ecosystem/export-profiles/)
- [JavaScript documentation](https://mdi.illusions.app/bindings/javascript/)

Part of the [MDI repository](https://github.com/illusions-lab/MDI). MIT licensed.
