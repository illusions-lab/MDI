# @illusions-lab/mdi

## 2.0.21

### Patch Changes

- Isolate Rust-owned mdast provenance under `@illusions-lab/mdi/internal/mdast`
  and keep it out of general parsing and text projection.
- Updated dependencies
  - @illusions-lab/mdi-core@2.0.21

## 2.0.2

### Patch Changes

- Make Rust the direct CLI path for HTML, text, EPUB, and DOCX. PDF now receives
  Rust-rendered HTML before Chromium layout, and the CLI no longer ships its
  duplicate mdast text or document renderers.
- Updated dependencies
  - @illusions-lab/mdi-core@2.0.2
