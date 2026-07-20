# @illusions-lab/mdi-remark

## 2.0.17

### Patch Changes

- Make Rust the direct CLI path for HTML, text, EPUB, and DOCX. PDF now receives
  Rust-rendered HTML before Chromium layout, and the CLI no longer ships its
  duplicate mdast text or document renderers.
- Updated dependencies
  - @illusions-lab/mdi@2.0.2
  - mdast-util-mdi@2.0.16

## 2.0.4

### Patch Changes

- Add the Rust MDI syntax core to the repository verification pipeline. The
  JavaScript micromark/remark API and parsed output are unchanged; this release
  establishes the shared language-neutral grammar foundation for future native
  bindings.
- Updated dependencies
  - micromark-extension-mdi@2.0.3
  - mdast-util-mdi@2.0.3

## 2.0.3

### Patch Changes

- Complete MDI 2.0 parser core: micromark tokenizers for every MDI construct (ruby, tate-chu-yoko, boten + `《《…》》` alias, bracket macros, blank paragraphs, block macros), the mdast utility with round-trip serialization, and the bundled remark plugin with GFM, YAML front matter, and spec-default front matter resolution. Includes spec-conformance fixes surfaced by edge-case testing: the ruby-local `\.` escape (SYNTAX.md §2), em-mark disambiguation for marks that need escaping, and grapheme-aware split-ruby matching.
- Updated dependencies
  - micromark-extension-mdi@2.0.2
  - mdast-util-mdi@2.0.2
