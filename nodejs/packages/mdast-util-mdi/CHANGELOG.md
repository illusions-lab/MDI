# mdast-util-mdi

## 2.0.16

### Patch Changes

- Updated dependencies
  - @illusions-lab/mdi-core@2.0.2

## 2.0.3

### Patch Changes

- Add the Rust MDI syntax core to the repository verification pipeline. The
  JavaScript micromark/remark API and parsed output are unchanged; this release
  establishes the shared language-neutral grammar foundation for future native
  bindings.
- Updated dependencies
  - micromark-extension-mdi@2.0.3

## 2.0.2

### Patch Changes

- Complete MDI 2.0 parser core: micromark tokenizers for every MDI construct (ruby, tate-chu-yoko, boten + `《《…》》` alias, bracket macros, blank paragraphs, block macros), the mdast utility with round-trip serialization, and the bundled remark plugin with GFM, YAML front matter, and spec-default front matter resolution. Includes spec-conformance fixes surfaced by edge-case testing: the ruby-local `\.` escape (SYNTAX.md §2), em-mark disambiguation for marks that need escaping, and grapheme-aware split-ruby matching.
- Updated dependencies
  - micromark-extension-mdi@2.0.2
