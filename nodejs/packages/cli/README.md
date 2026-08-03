# `@illusions-lab/mdi-cli`

Command-line interface for converting `.mdi` documents through the
Rust-authoritative MDI engine.

## Install

```sh
npm install --global @illusions-lab/mdi-cli
```

## Common commands

```sh
mdi book.mdi                         # HTML: book.html
mdi book.mdi --to json               # JSON IR: book.json
mdi build book.mdi --to epub -o book.epub
mdi check book.mdi                   # print parser diagnostics
mdi --version
mdi update --check
```

`build` remains fully supported. The default output is HTML; an explicit
`--to` takes precedence over the default, and a recognized `-o` extension can
select the format (`.html`, `.json`, `.epub`, `.docx`, `.pdf`, `.txt`). A
conflicting explicit format and output extension is rejected.

Supported formats are `html`, `json`, `pdf`, `epub`, `docx`, `txt`, `txt-ruby`,
`narou`, `kakuyomu`, `aozora`, `note`, and `txt-all`.

## Updates and CI

`mdi update` checks npm for the latest CLI and asks before installing it.
`mdi update --check` never installs; `mdi update --yes` is suitable for an
explicitly authorized automation job. Non-interactive sessions only print the
install command. Every normal CLI invocation performs a best-effort daily
cached update check in the background; registry errors never affect the
command or its stdout. Set `MDI_NO_UPDATE_CHECK=1` to disable that check.

For CI diagnostics, use:

```sh
MDI_NO_UPDATE_CHECK=1 mdi check book.mdi
```

`check` exits 0 for no diagnostics or warnings and exits 1 when an error
diagnostic is present.

## Architecture

The CLI does not parse MDI or implement publication formats itself. HTML,
EPUB, DOCX, and text call the Rust engine through `@illusions-lab/mdi`.
Profile defaults, validation, paper dimensions, and print CSS also come from
Rust. The host-specific step is launching Chromium for PDF.

See the [CLI guide](https://mdi.illusions.app/bindings/cli/) for the complete
format and export-profile reference.
