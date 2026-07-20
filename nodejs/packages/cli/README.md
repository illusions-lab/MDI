# `@illusions-lab/mdi-cli`

Command-line interface for building complete `.mdi` documents through the
Rust-authoritative MDI engine.

## Install

```sh
npm install --global @illusions-lab/mdi-cli
```

## Build a document

```sh
mdi build input.mdi --to html|pdf|epub|docx|txt|txt-ruby|narou|kakuyomu|aozora|txt-all \
  [--config export.json] [-o output]
```

HTML, EPUB, DOCX, and text output call `mdi-core` directly through the
JavaScript binding. PDF passes Rust-rendered HTML to Chromium solely for page
layout; Chromium never receives or parses MDI source. `--config` currently
applies PDF and text settings. EPUB and DOCX use Rust's deterministic baseline
and front matter metadata while their full profile options move into Rust.

`txt-all` writes every text variant next to the input and does not accept `-o`.

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

The CLI does not parse MDI itself. HTML, EPUB, DOCX, and text call the Rust
engine through `@illusions-lab/mdi`; PDF gives Rust-rendered HTML to Chromium
solely for print layout. `--config` currently configures PDF and text output.

## Documentation

- [CLI guide](https://mdi.illusions.app/bindings/cli/)
- [Export profiles](https://mdi.illusions.app/guides/export-profiles/)
- [JavaScript documentation](https://mdi.illusions.app/bindings/javascript/)

Part of the [MDI repository](https://github.com/illusions-lab/MDI). MIT licensed.
